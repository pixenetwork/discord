import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketEngine } from '../src/platform/tickets.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: { staff: 'bhrp_staff' },
  },
  blood_diamond_rp: {
    canonicalRoleIds: { staff: 'bdrp_staff' },
  },
};

function staffActor(tenantId) {
  return {
    userId: `${tenantId}_staff_user`,
    tenantId,
    roleIds: [tenantId === 'beverly_hills_rp' ? 'bhrp_staff' : 'bdrp_staff'],
  };
}

test('ticket types are configurable while preserving the default type set', () => {
  const engine = createTicketEngine({
    authorization,
    ticketTypes: {
      enquiry: { label: 'Questions & Enquiries' },
      tebex: { enabled: false },
    },
  });

  const enquiry = engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'enquiry',
    createdBy: 'player_1',
    subject: 'How do I appeal a warning?',
  });
  assert.equal(enquiry.typeKey, 'enquiry');

  assert.throws(() => engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'tebex',
    createdBy: 'player_2',
  }), /Unsupported ticket type/);
});

test('claim/unclaim, close request, close, and reopen preserve tenant-scoped state', () => {
  const engine = createTicketEngine({ authorization });
  const ticket = engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'standard',
    createdBy: 'player_3',
    participantIds: ['player_4'],
  });

  const staff = staffActor('beverly_hills_rp');
  const claimed = engine.claimTicket({ ticketId: ticket.id, actor: staff });
  assert.equal(claimed.claimedBy, staff.userId);
  assert.equal(claimed.tenantId, 'beverly_hills_rp');

  const unclaimed = engine.unclaimTicket({ ticketId: ticket.id, actor: staff });
  assert.equal(unclaimed.claimedBy, null);

  const requested = engine.requestClose({
    ticketId: ticket.id,
    actor: { userId: 'player_3', tenantId: 'beverly_hills_rp', roleIds: [] },
    reason: 'resolved',
  });
  assert.equal(requested.status, 'close_requested');
  assert.equal(requested.closeRequestedBy, 'player_3');

  const closed = engine.closeTicket({ ticketId: ticket.id, actor: staff, reason: 'done' });
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedBy, staff.userId);

  const reopened = engine.reopenTicket({ ticketId: ticket.id, actor: staff, reason: 'follow-up needed' });
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.closedBy, null);
});

test('participant add/remove is role-gated and keeps creator attached', () => {
  const engine = createTicketEngine({ authorization });
  const ticket = engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'bug',
    createdBy: 'reporter_1',
  });

  const staff = staffActor('beverly_hills_rp');
  const added = engine.addParticipant({ ticketId: ticket.id, actor: staff, participantId: 'engineer_1' });
  assert.ok(added.participants.includes('engineer_1'));

  const removed = engine.removeParticipant({ ticketId: ticket.id, actor: staff, participantId: 'engineer_1' });
  assert.equal(removed.participants.includes('engineer_1'), false);

  assert.throws(() => engine.removeParticipant({
    ticketId: ticket.id,
    actor: staff,
    participantId: 'reporter_1',
  }), /Cannot remove ticket creator/);
});

test('reminders and transcript metadata include tenant IDs and traceability', () => {
  const engine = createTicketEngine({ authorization });
  const ticket = engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'staff_report',
    createdBy: 'citizen_88',
  });

  const staff = staffActor('beverly_hills_rp');
  const reminder = engine.scheduleReminder({
    ticketId: ticket.id,
    actor: staff,
    dueAt: '2026-08-09T08:00:00.000Z',
    message: 'Follow up in one hour',
    now: '2026-08-09T07:00:00.000Z',
  });
  assert.equal(reminder.tenantId, 'beverly_hills_rp');

  const due = engine.dueReminders({
    tenantId: 'beverly_hills_rp',
    now: '2026-08-09T09:00:00.000Z',
  });
  assert.equal(due.length, 1);

  const resolved = engine.resolveReminder({
    ticketId: ticket.id,
    reminderId: reminder.id,
    actor: staff,
    now: '2026-08-09T09:05:00.000Z',
  });
  assert.equal(resolved.resolvedBy, staff.userId);

  const transcript = engine.transcriptMetadata({
    tenantId: 'beverly_hills_rp',
    ticketId: ticket.id,
  });
  assert.equal(transcript.tenantId, 'beverly_hills_rp');
  assert.equal(transcript.ticketId, ticket.id);
  assert.equal(transcript.reminderCount, 1);
  assert.ok(transcript.reminderIds.includes(reminder.id));
});

test('canonical-role authorization fails closed and tenant boundaries stay isolated', () => {
  const engine = createTicketEngine({
    authorization: {
      beverly_hills_rp: {
        canonicalRoleIds: { staff: 'bhrp_staff' },
      },
      blood_diamond_rp: {
        canonicalRoleIds: { },
      },
    },
  });

  const ticket = engine.createTicket({
    tenantId: 'beverly_hills_rp',
    typeKey: 'ban_appeal',
    createdBy: 'player_6',
  });

  assert.throws(() => engine.claimTicket({
    ticketId: ticket.id,
    actor: { userId: 'outsider', tenantId: 'blood_diamond_rp', roleIds: ['bdrp_staff'] },
  }), /Cross-tenant access denied/);

  assert.throws(() => engine.claimTicket({
    ticketId: ticket.id,
    actor: { userId: 'helper', tenantId: 'beverly_hills_rp', roleIds: ['random_role'] },
  }), /Authorization denied/);

  const bdrpTicket = engine.createTicket({
    tenantId: 'blood_diamond_rp',
    typeKey: 'standard',
    createdBy: 'player_7',
  });

  assert.throws(() => engine.claimTicket({
    ticketId: bdrpTicket.id,
    actor: { userId: 'bdrp_helper', tenantId: 'blood_diamond_rp', roleIds: ['bdrp_staff'] },
  }), /Missing canonical role IDs/);
});
