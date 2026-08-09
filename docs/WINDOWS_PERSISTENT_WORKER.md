# Aquaphoria Windows Persistent Worker

The Aquaphoria worker is designed to stay online without manual reconnection. The repository includes a self-healing supervisor plus a Windows Scheduled Task installer.

## One-time host setup

1. Install Node.js 20+.
2. Clone/update this repository on the dedicated host.
3. In the repository root, create `.env` from `.env.example` and fill the runtime secrets locally. Never commit or paste secrets into Discord/GitHub.
4. Run local validation:

```powershell
npm install --no-audit --no-fund
npm run check
npm test
```

5. From an elevated PowerShell in the repository root, install the persistent worker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\install-aquaphoria-worker-task.ps1
```

The installer creates the **Aquaphoria Discord Worker** Scheduled Task, starts it immediately, and configures startup recovery. The supervisor also restarts Node if the process exits or repeated `/health` checks fail.

## Verify

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-aquaphoria-worker.ps1
```

A successful verification returns `workerReady: true` and `gptConfigured: true`.

## Logs

Runtime logs are kept under:

- `logs/aquaphoria-supervisor.log`
- `logs/aquaphoria-worker.out.log`
- `logs/aquaphoria-worker.err.log`

The runtime state remains in `DATA_DIR` (default `./data`) and should be backed up separately from the source checkout.

## Recovery behavior

The system has two recovery layers:

- Windows Scheduled Task starts the supervisor after boot and retries the supervisor after unexpected failure.
- The supervisor owns the Node worker, detects process exits, polls `/health`, and restarts the worker after repeated unhealthy responses.

Only one supervisor instance can own the worker at a time through a global mutex. This avoids duplicate Discord sessions and duplicate webhook workers.

## Go-live check

After the verifier succeeds:

1. Run `/aquaphoria setup` in the Aquaphoria Discord as the configured owner.
2. Confirm vendor/staff/research categories have the intended private permissions.
3. Verify `/research` and `/gpt` respond.
4. Send a Shopify paid-order test webhook and confirm one private vendor fulfillment ticket is created per vendor.
5. Verify payout state, shipment/tracking, and customer support tickets.

FXServer does not need to be restarted for this worker.
