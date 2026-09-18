import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketEngine } from '../src/platform/tickets.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: { staff: 'bhrp_staff' },
  },
  blood_diamond_rp: {
    canonicalRoleIds: { staff: 'bdrp_staff' },
  },
};

const identity = createTestIdentityAdapter();

function staffActor(tenantId) {
  return bindActor(
    identity,
    tenantId,
    `${tenantId}_staff_user`,
    [tenantId === 'beverly_hills_rp' ? 'bhrp_staff' : 'bdrp_staff'],
  );
}

function playerActor(tenantId, userId) {
  return bindActor(identity, tenantId, userId, []);
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
    actor: playerActor('beverly_hills_rp', 'player_1'),
    typeKey: 'enquiry',
    subject: 'How do I appeal a warning?',
  });
  assert.equal(enquiry.typeKey, 'enquiry');

  assert.throws(() => engine.createTicket({
    actor: playerActor('beverly_hills_rp', 'player_2'),
    typeKey: 'tebex',
  }), /Unsupported ticket type/);
});

test('claim/unclaim, close request, close, and reopen preserve tenant-scoped state', () => {
  const engine = createTicketEngine({ authorization });
  const player = playerActor('beverly_hills_rp', 'player_3');
  const ticket = engine.createTicket({
    actor: player,
    typeKey: 'standard',
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
    actor: player,
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
    actor: playerActor('beverly_hills_rp', 'reporter_1'),
    typeKey: 'bug',
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
    actor: playerActor('beverly_hills_rp', 'citizen_88'),
    typeKey: 'staff_report',
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
    actor: staff,
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

  const fetched = engine.getTicket({ actor: staff, ticketId: ticket.id });
  assert.equal(fetched.id, ticket.id);

  const transcript = engine.transcriptMetadata({
    actor: staff,
    ticketId: ticket.id,
  });
  assert.equal(transcript.tenantId, 'beverly_hills_rp');
  assert.equal(transcript.ticketId, ticket.id);
  assert.equal(transcript.reminderCount, 1);
  assert.ok(transcript.reminderIds.includes(reminder.id));
});

test('privileged ticket reads require verified actor and canonical roles', () => {
  const engine = createTicketEngine({ authorization });
  const staff = staffActor('beverly_hills_rp');
  const ticket = engine.createTicket({
    actor: playerActor('beverly_hills_rp', 'reader_1'),
    typeKey: 'standard',
  });
  engine.scheduleReminder({
    ticketId: ticket.id,
    actor: staff,
    dueAt: '2026-08-09T08:00:00.000Z',
    message: 'ping',
    now: '2026-08-09T07:00:00.000Z',
  });

  const emptyRoles = bindActor(identity, 'beverly_hills_rp', 'empty', []);
  const lookalike = bindActor(identity, 'beverly_hills_rp', 'lookalike', ['Staff', 'bhrp_staff_lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.getTicket({ actor: denied, ticketId: ticket.id }), /Authorization denied/);
    assert.throws(() => engine.dueReminders({ actor: denied }), /Authorization denied/);
    assert.throws(() => engine.transcriptMetadata({ actor: denied, ticketId: ticket.id }), /Authorization denied/);
  }
  assert.throws(() => engine.getTicket({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bhrp_staff'] },
    ticketId: ticket.id,
  }), /Unverified Discord identity/);
  assert.throws(() => engine.getTicket({
    actor: staffActor('blood_diamond_rp'),
    ticketId: ticket.id,
  }), /Cross-tenant access denied/);
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
    actor: playerActor('beverly_hills_rp', 'player_6'),
    typeKey: 'ban_appeal',
  });

  assert.throws(() => engine.claimTicket({
    ticketId: ticket.id,
    actor: bindActor(identity, 'blood_diamond_rp', 'outsider', ['bdrp_staff']),
  }), /Cross-tenant access denied/);

  assert.throws(() => engine.claimTicket({
    ticketId: ticket.id,
    actor: bindActor(identity, 'beverly_hills_rp', 'helper', ['random_role']),
  }), /Authorization denied/);

  assert.throws(() => engine.claimTicket({
    ticketId: ticket.id,
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bhrp_staff'] },
  }), /Unverified Discord identity/);

  const bdrpTicket = engine.createTicket({
    actor: playerActor('blood_diamond_rp', 'player_7'),
    typeKey: 'standard',
  });

  assert.throws(() => engine.claimTicket({
    ticketId: bdrpTicket.id,
    actor: bindActor(identity, 'blood_diamond_rp', 'bdrp_helper', ['bdrp_staff']),
  }), /Missing canonical role IDs/);
});
