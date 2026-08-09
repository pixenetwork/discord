export function parseJsonBody(rawBody) {
  try {
    return { ok: true, value: JSON.parse(rawBody.toString('utf8')) };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}
