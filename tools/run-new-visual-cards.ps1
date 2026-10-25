param([switch]$Apply,[int]$Limit=3)
$ErrorActionPreference='Stop'
$live='C:\Users\duy\.jarvis-worktrees\discord-d2-recovery-20261002'
Push-Location $live
try{
 $env:DOTENV_CONFIG_PATH=Join-Path $live '.env'
 $args2=@("--limit=$Limit")
 if($Apply){$args2+=@('--apply','--owner-approved-publication')}
 & node -r dotenv/config 'D:\PixelNetwork\discord-lineage-sync-20261024\tools\publish-unmatched-medaka-cards.mjs' @args2
 if($LASTEXITCODE -ne 0){throw ('New-card publisher failed exit '+$LASTEXITCODE)}
} finally{Remove-Item Env:\DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue;Pop-Location}
