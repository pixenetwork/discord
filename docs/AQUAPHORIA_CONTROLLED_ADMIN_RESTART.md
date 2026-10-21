# Aquaphoria Discord operator restart

This procedure activates the already-tested `/research-queue` command after a
code update. It does **not** configure Jarvis, trigger new research, retry
eight old `started` jobs, or publish anything.

Use the **existing main PC** and an **elevated Windows PowerShell** session.
Only the existing task is managed; do not start a second Node or Discord bot.

Preview (no task or process modifications):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-aquaphoria-worker-admin.ps1
```

Controlled activation after choosing a suitable moment to interrupt the bot:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-aquaphoria-worker-admin.ps1 -Apply
```

The script fails closed if the task name, expected supervisor action, worker
checkout, port ownership, or read-back prerequisites do not match. It backs up
and hashes the existing durable state before stopping the **Aquaphoria Discord
Worker** task. It refuses to start a replacement while the old listener exists.
Finally, it requires one new healthy worker and confirms the owner-only
`/research-queue` Discord application command over a read-only API request.

Administrator rights are required by Windows to change the protected
Scheduled Task. HostOps V3's existing policy does **not** authorize this
Aquaphoria task, so it must not be used as a privilege bypass.

If any step fails after the task stop, investigate the log and its preserved
backup; do **not** spawn an unmanaged bot. Confirm `/health`, `/ready`, and
command registration before reporting activation.
