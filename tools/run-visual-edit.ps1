param([switch]$Apply,[string]$Slug='', [int]$Offset=0,[int]$Limit=3,[string]$ApprovedRendererHead='')
$ErrorActionPreference='Stop'
$live='C:\Users\duy\.jarvis-worktrees\discord-d2-recovery-20261002'
$script='D:\PixelNetwork\discord-lineage-sync-20261024\tools\apply-medaka-lineage-cards.mjs'
Push-Location $live
try {
 if($ApprovedRendererHead -notmatch '^[0-9a-f]{40}$'){throw 'Explicit approved Aquapedia renderer HEAD required'}
 $env:AQUAPEDIA_LINEAGE_RENDERER_HEAD=$ApprovedRendererHead
 $env:DOTENV_CONFIG_PATH=Join-Path $live '.env'
 $params=@("--offset=$Offset","--limit=$Limit")
 if($Slug){$params+=("--slug=$Slug")}
 if($Apply){$params+=@('--apply','--owner-approved-edit')}
 & node -r dotenv/config $script @params
 if($LASTEXITCODE -ne 0){throw ("Lineage edit process failed: "+$LASTEXITCODE)}
} finally {Remove-Item Env:\DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue;Remove-Item Env:\AQUAPEDIA_LINEAGE_RENDERER_HEAD -ErrorAction SilentlyContinue;Pop-Location}
