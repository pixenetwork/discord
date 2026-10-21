import {classifyCrossTaxaRecord} from './aquapedia-cross-taxa-publication-policy.mjs';

/**
 * Exact index-to-clause alignment with IKGH International High-Breeding
 * Standard 2023 (Supplement 3 and item 207). This is NOT genotype/lineage
 * verification, nor permission to publish. Names MUST match the live source.
 */
export const IKGH_2023_URL='https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf';
const base=[
 ['Wild grey','195'],['Gold base','196'],['Blond base','197'],['Blue base','198'],
 ['Pink base','199'],['Albino (RREA) base','200'],['White base','201'],
 ['Silver base','202'],['Cream base','203'],['Lutino (WREA) base','203a']
];
const cover=[
 ['Red cover','205.1'],['Blue cover','205.2'],['Green cover','205.3'],
 ['Yellow cover','205.4'],['White cover','205.5'],['Black cover','205.6'],
 ['Neon','205.7'],['Moscow','205.8'],['Metallic','205.9'],['Half-black','205.10'],
 ['Three-quarter black','205.10'],['Snakeskin','205.11'],['Lace / Filigree','205.11'],
 ['Viennese Emerald','205.12'],['One single color','205.13'],['Two-tone','205.14'],
 ['Multicolor','205.15'],['Mosaic','205.16'],['Galaxy','205.17'],
 ['Japan Blue','205.18'],['Singa Blue','205.18'],['Blue Grass','205.19'],
 ['Red Grass','205.19'],['Santa Maria','205.20'],['Pink Moscow / Panda','207']
];
const tail=[
 ['Fan Tail','A1'],['Triangle Tail / Delta','A2'],['Veil Tail','A3'],
 ['Flag Tail','A4'],['Halfmoon Tail','A5'],['Double Swordtail','B1'],
 ['Top Swordtail','B2'],['Bottom Swordtail','B3'],['Lyre Tail','B4'],
 ['Spade Tail','C1'],['Spear Tail','C2'],['Round Tail','C3'],['Needle / Pin Tail','C4']
];
const definitions=[...base.map(([name,code])=>({name,code,kind:'base',sourceSection:'Supplement 3, items 195–203a'})),
 ...cover.map(([name,code])=>({name,code,kind:'cover',sourceSection:code==='207'?'Item 207, page 43':'Supplement 3, item 205, pages 40–42'})),
 ...tail.map(([name,code])=>({name,code,kind:'tail',sourceSection:'Items 209–211, page 43'}))];
if(definitions.length!==48)throw Error('IKGH crosswalk expected exactly 48 definitions');
const reject=reason=>{throw Error('IKGH crosswalk: '+reason)};

export function mapIkghGuppyTrait(record){
 let decision;
 try{decision=classifyCrossTaxaRecord(record).decision;}
 catch(e){reject('invalid source record: '+e.message);}
 if(decision!=='review_required')reject('trade label must remain held');
 const match=/^\/guppypedia\/entries\/gup-(\d{3})\/$/.exec(record.url);
 if(!match)reject('wrong path');
 const id=Number(match[1]);
 if(id<1||id>48)reject('unknown IHS trait number');
 const expected=definitions[id-1];
 if(record.name!==expected.name||record.type!=='Guppy standardized trait')reject('identity mismatch for gup-'+match[1]);
 return {
  id:match[1],name:expected.name,kind:expected.kind,code:expected.code,
  sourceUrl:IKGH_2023_URL,sourceSection:expected.sourceSection,
  evidenceStatus:'IKGH source terminology match; genetics and stock pedigree not verified',
  publicationAuthorized:false
 };
}

/** Validate all 48 source-recognized labels and optionally all 128 trade entries.
 * This does not claim the IKGH validates particular specimens or market names. */
export function auditIkghGuppyCohort(records,{expectFullCohort=false}={}){
 if(!Array.isArray(records))reject('input not an array');
 const seen=new Set(),matched=[];
 const counts={base:0,cover:0,tail:0,trade:0};
 for(const record of records){
  const status=classifyCrossTaxaRecord(record);
  if(status.group!=='guppy')reject('non-Guppy in cohort');
  if(seen.has(record.url))reject('duplicate route '+record.url);
  seen.add(record.url);
  if(status.decision==='hold_unverified_trade'){
   const m=/^\/guppypedia\/entries\/gup-(\d{3})\/$/.exec(record.url);
   const n=Number(m?.[1]);
   const expectedType=n>=49&&n<=70?'Guppy documented commercial line':
     n<=140?'Guppy documented hobby label':n<=146?'Guppy documented trade trait':
     n<=171?'Guppy documented seller label':n<=176?'Guppy separate-species or hybrid-related label':null;
   if(n<49||n>176||record.type!==expectedType)reject('trade label path or type is not confirmed');
   counts.trade++;
   continue;
  }
  const x=mapIkghGuppyTrait(record);
  counts[x.kind]++;matched.push(x);
 }
 if(counts.base!==10||counts.cover!==25||counts.tail!==13)reject('not all 48 IHS entries present');
 if(expectFullCohort&&(records.length!==176||counts.trade!==128))reject('expected exactly 128 held trade entries');
 return {total:records.length,counts,tradeHeld:counts.trade,records:matched,publicationAuthorized:false};
}
