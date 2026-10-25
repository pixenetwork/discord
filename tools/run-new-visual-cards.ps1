param([switch]$Apply,[int]$Limit=3,[string]$ApprovedRendererHead='')
$ErrorActionPreference='Stop'
$live='C:\Users\duy\.jarvis-worktrees\discord-d2-recovery-20261002'
Push-Location $live
try{
 if($ApprovedRendererHead -notmatch '^[0-9a-f]{40}$'){throw 'Explicit approved Aquapedia renderer HEAD required'}
 $env:AQUAPEDIA_LINEAGE_RENDERER_HEAD=$ApprovedRendererHead
 $env:DOTENV_CONFIG_PATH=Join-Path $live '.env'
 $args2=@("--limit=$Limit")
 if($Apply){$args2+=@('--apply','--owner-approved-publication')}
 & node -r dotenv/config 'D:\PixelNetwork\discord-lineage-sync-20261024\tools\publish-unmatched-medaka-cards.mjs' @args2
 if($LASTEXITCODE -ne 0){throw ('New-card publisher failed exit '+$LASTEXITCODE)}
} finally{Remove-Item Env:\DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue;Remove-Item Env:\AQUAPEDIA_LINEAGE_RENDERER_HEAD -ErrorAction SilentlyContinue;Pop-Location}
