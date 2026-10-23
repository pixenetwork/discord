param()
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$first='resources/aquapedia-pleco-24-doi-bibliography-20261023.json'
$dest='resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json'
if(Test-Path $dest){throw 'Evidence already exists, refuse overwrite'}
$x=Get-Content $first -Raw -Encoding UTF8|ConvertFrom-Json
$rows=@()
foreach($item in $x.results){
 $state='retained_initial_metadata'
 $meta=$item.metadata
 $http=$null
 $errorMessage=$null
 if(!$item.metadataFound){
  $escaped=[System.Uri]::EscapeDataString([string]$item.doi)
  foreach($source in @('Crossref','DataCite')){
   $url='https://api.crossref.org/works/'+$escaped
   if($source -eq 'DataCite'){$url='https://api.datacite.org/dois/'+$escaped}
   try{
    $r=Invoke-RestMethod -Uri $url -TimeoutSec 18 -Headers @{'User-Agent'='Aquapedia-source-review/1.0'}
    if($source -eq 'Crossref'){
     $d=$r.message
     if(!$d.DOI){continue}
     $meta=[PSCustomObject]@{
      registry='Crossref'
      resolvedDoi=([string]$d.DOI).ToLowerInvariant()
      title=([string]$d.title[0] -replace '<[^>]+>',' ' -replace '\s+',' ').Trim()
      year=$d.published.'date-parts'[0][0]
      journal=[string]$d.'container-title'[0]
      type=[string]$d.type
     }
    }else{
     $d=$r.data.attributes
     if(!$d.doi){continue}
     $meta=[PSCustomObject]@{
      registry='DataCite'
      resolvedDoi=([string]$d.doi).ToLowerInvariant()
      title=[string]$d.titles[0].title
      year=$d.publicationYear
      journal=[string]$d.publisher
      type=[string]$d.types.resourceTypeGeneral
     }
    }
    $state='resolved_with_'+$source+'_powershell_recheck'
    break
   }catch{
    $errorMessage=$_.Exception.Message.Substring(0,[Math]::Min(130,$_.Exception.Message.Length))
   }
  }
  if(!$meta){$state='registry_lookup_unresolved'}
 }
 $rows+=([PSCustomObject]@{
  doi=$item.doi
  usedBy=$item.usedBy
  status=$state
  metadataFound=[bool]$meta
  registryDoiExactMatch=[bool]($meta -and ([string]$meta.resolvedDoi).ToLowerInvariant() -eq $item.doi)
  metadata=$meta
  error=$errorMessage
  claimVerified=$false
  mediaRightsVerified=$false
 })
}
if($rows.Count -ne 24){throw 'DOI source inventory drift'}
$counts=[PSCustomObject]@{
 total=$rows.Count
 metadataFound=@($rows|Where-Object {$_.metadataFound}).Count
 exactDoiMatch=@($rows|Where-Object {$_.registryDoiExactMatch}).Count
 unresolved=@($rows|Where-Object {!$_.metadataFound}).Count
 recovered=@($rows|Where-Object {$_.status -like 'resolved_with_*'}).Count
}
$final=[PSCustomObject]@{
 capturedAt=(Get-Date).ToUniversalTime().ToString('o')
 originalEvidenceFile=$first
 scope='Crossref/DataCite bibliographic metadata for active Pleco references'
 publicationAuthorized=$false
 verifiedBiologicalClaims=0
 discordWrites=0
 counts=$counts
 rows=$rows
}
$final|ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $dest -Encoding utf8 -NoNewline
Write-Output ('PLECO_DOI_REGISTRY_RECHECK '+($counts|ConvertTo-Json -Compress))
$rows|Where-Object {!$_.metadataFound}|ForEach-Object{Write-Output ('UNRESOLVED '+$_.doi+' '+$_.error)}
