$ErrorActionPreference='Stop'
$live='C:\Users\duy\.jarvis-worktrees\discord-d2-recovery-20261002'
Push-Location $live
try{
 $env:DOTENV_CONFIG_PATH=Join-Path $live '.env'
 & node -r dotenv/config 'D:\PixelNetwork\discord-lineage-sync-20261024\tools\verify-medaka-lineage-cards-live.mjs'
 if($LASTEXITCODE -ne 0){throw ('Live lineage verification failed: '+$LASTEXITCODE)}
} finally {Remove-Item Env:\DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue;Pop-Location}
