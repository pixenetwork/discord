/**
 * Pseudoqolus koko is an original scientific-species nomenclature source
 * link and uncertain evolutionary hypothesis, NEVER a breeding pedigree.
 */
export const KOKO_SOURCE_PLAN=Object.freeze({
 key:'pana-koko',
 threadId:'1561147053097230420',
 threadName:'Pseudoqolus koko — originally Panaqolus koko',
 spid:'72287',
 originalName:'Panaqolus koko',
 acceptedName:'Pseudoqolus koko',
 catalogUrl:'https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=72287',
 originalPdfUrl:'https://www.sfi-cybium.fr/sites/default/files/pdfs-cybium/11-FischMuller%5BGuianas%5D%20colour.pdf',
 phylogenyDoi:'10.1016/j.ympev.2016.12.040'
});
const fail=s=>{throw Error('Pleco koko source: '+s)};
export function buildPlecoKokoIndex(catalog){
 const p=KOKO_SOURCE_PLAN;
 if(!Array.isArray(catalog)||catalog.length!==167)fail('source cohort changed');
 const rows=catalog.filter(x=>x.slug===p.key&&x.group==='pleco');
 if(rows.length!==1||rows[0].url!=='/plecopedia/research/pana-koko/'||
    rows[0].status!=='Research draft — independent review pending')
  fail('public source identity/status changed');
 const pageUrl='https://aquapedia.app'+rows[0].url;
 const marker='[AQUAPEDIA-PLECO-KOKO-2017:20261023]';
 const content=[
  '**Plecopedia — corrected scientific naming history (research draft)**',
  'Aquapedia source index: '+pageUrl,
  '**Original description (2012):** *Panaqolus koko* (Fisch-Muller & Covain).',
  '**Revised genus (2017):** *Pseudoqolus koko*; primary molecular phylogeny: https://doi.org/'+p.phylogenyDoi,
  'Taxonomic reference: '+p.catalogUrl,
  '**Genetic hypothesis (not pedigree):** a mitochondrial introgression possibility involving *Peckoltia* was discussed, but ancestral parentage, precise placement and aquarium crosses are NOT established.',
  'The names and study do not authenticate any aquarium specimen, breeder line, husbandry prescription or image rights. No third-party photos or paper content reproduced.',
  marker
 ].join('\n');
 if(content.length>1500||content.includes('@everyone')||content.includes('@here'))fail('unsafe content');
 return {...p,pageUrl,marker,content,photos:0,specimenVerified:false,breedLineageVerified:false};
}
