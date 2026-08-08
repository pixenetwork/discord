import { parseJsonBody } from './webhook-body.mjs';

function response(statusCode, body) {
  return { statusCode, body };
}

function validOrderPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const id = value.id;
  return (typeof id === 'string' || typeof id === 'number') && String(id).trim().length > 0;
}

export function createPaidOrderWebhookHandler({
  shopify,
  store,
  orders,
  getGuild,
  logError = async () => undefined,
}) {
  return async function handlePaidOrderWebhook({ rawBody, hmac }) {
    let verified;
    try {
      verified = shopify.verifyWebhook(rawBody, hmac);
    } catch (error) {
      await logError(`Shopify webhook verification failed: ${error.stack ?? error.message}`);
      return response(500, { ok: false, error: 'webhook_verification_failed' });
    }
    if (!verified) return response(401, { ok: false, error: 'invalid_hmac' });

    const parsedBody = parseJsonBody(rawBody);
    if (!parsedBody.ok) return response(400, { ok: false, error: parsedBody.error });
    const order = parsedBody.value;
    if (!validOrderPayload(order)) return response(400, { ok: false, error: 'invalid_order_payload' });

    const webhookId = `shopify:orders-paid:${String(order.id)}`;
    let claim;
    try {
      claim = await store.claimWebhook(webhookId);
    } catch (error) {
      await logError(`Shopify webhook claim failed for ${webhookId}: ${error.stack ?? error.message}`);
      return response(500, { ok: false, error: 'webhook_claim_failed' });
    }

    if (!claim.claimed) {
      if (claim.reason === 'completed') {
        return response(200, { ok: true, duplicate: true });
      }
      return response(409, { ok: false, retry: true, error: 'webhook_in_progress' });
    }

    try {
      const guild = await getGuild();
      await orders.routePaidOrder(guild, order);
      await store.completeWebhook(webhookId);
      return response(200, { ok: true });
    } catch (error) {
      await store.failWebhook(webhookId, error).catch(async (stateError) => {
        await logError(`Could not persist failed webhook ${webhookId}: ${stateError.stack ?? stateError.message}`);
      });
      await logError(`Shopify order routing failed for ${order.name ?? order.id}: ${error.stack ?? error.message}`);
      return response(500, { ok: false, retry: true, error: 'order_routing_failed' });
    }
  };
}
