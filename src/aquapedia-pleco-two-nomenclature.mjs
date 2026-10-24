/**
 * Curated two-name taxonomy lineage, NOT a genetic pedigree.
 * Original combination -> accepted combination documented by primary work
 * and authoritative catalog. Posts are source-only indexes of research drafts.
 */
export const PLECO_NOMENCLATURE_TARGETS=Object.freeze({
 'hyp-vandragti':Object.freeze({
  threadId:'1561147015482839093',
  threadName:'Hypancistrus vandragti — former Micracanthicus',
  originalName:'Micracanthicus vandragti',
  currentName:'Hypancistrus vandragti',
  originalSource:'https://doi.org/10.1643/CI-10-008',
  modernSource:'https://www.ni.bio.br/1982-0224-2024-0080/',
  authority:'https://www.gbif.org/taxon/Q3KHM',
  keyText:'The 2011 original description named Micracanthicus vandragti; later phylogenetic revision places the species in Hypancistrus. This is a genus-name history, NOT an aquarium strain genealogy.'
 }),
 'pana-changae':Object.freeze({
  threadId:'1561174473669873706',
  threadName:'Panaqolus changae — Itaya/Momón barred dwarf',
  originalName:'Panaque changae',
  currentName:'Panaqolus changae',
  originalSource:'https://webhome.auburn.edu/~armbrjw/Panaque_changae.pdf',
  modernSource:'https://www.gbif.org/taxon/4C9CL',
  authority:'https://www.gbif.org/taxon/4C9CL',
  keyText:'Chockley and Armbruster described Panaque changae in 2002; Panaqolus changae is the accepted combination. The 2014 P. purusiensis redescription is comparative evidence, NOT the original description of P. changae.'
 })
});
const err=s=>{throw Error('Pleco nomenclature index: '+s)};
export function buildPlecoNomenclatureIndex(catalog,key){
 const t=PLECO_NOMENCLATURE_TARGETS[key];
 if(!t||!Array.isArray(catalog)||catalog.length!==167)err('unexpected target/source cohort');
 const rows=catalog.filter(x=>x.group==='pleco'&&x.slug===key);
 if(rows.length!==1||rows[0].status!=='Research draft — independent review pending'||
    rows[0].url!=='/plecopedia/research/'+key+'/')err('draft identity/status changed');
 const pageUrl='https://aquapedia.app'+rows[0].url;
 const marker='[AQUAPEDIA-PLECO-NOMENCLATURE:'+key+':20261023]';
 const content=[
  '**Plecopedia — scientific naming-history reference (working research)**',
  'Aquapedia entry: '+pageUrl,
  '**Original combination:** *'+t.originalName+'*',
  '**Current combination:** *'+t.currentName+'*',
  t.keyText,
  'Original publication: '+t.originalSource,
  'Current taxonomic evidence: '+t.modernSource,
  'Names alone do not verify an individual aquarium fish, a breeder lineage, genetics, spawning outcomes, or copyrighted photo rights.',
  marker
 ].join('\n');
 if(content.length>1450||content.includes('@everyone')||content.includes('@here'))err('unsafe/oversized message');
 return {key,...t,pageUrl,marker,content,sourceOnly:true,claimsAboutSpecimens:false,attachments:0};
}
