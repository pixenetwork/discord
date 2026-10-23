import fs from 'node:fs';
import { breedingEvidenceLines } from './corydoras-breeding-evidence.mjs';
import { morphAuditLines } from './corydoras-morph-audit.mjs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  Client, ClientUser, GatewayIntentBits, ChannelType, ChannelFlags, PermissionFlagsBits,
  AttachmentBuilder
} from 'discord.js';

const SOURCE_SHA = '86446265ba4bdbf02a5beb4011d34e8843f545a9';
const SOURCE_PATH = 'research/inbox/perplexity/corydoras-history-species-localities-breeders.md';
const REPO = process.env.AQUAPEDIA_WORKTREE || path.join(os.homedir(), 'Aquapedia-Release-20261014');
const SOURCE_URL = 'https://github.com/pixenetwork/aquapedia/blob/' + SOURCE_SHA + '/' + SOURCE_PATH;
const PR_URL = 'https://github.com/pixenetwork/aquapedia/pull/20';
const SOURCE_CATEGORY = '🧬・AQUAPEDIA — SPECIES & GENETICS';
const CATEGORY = '🧬・AQUAPEDIA — SPECIES & GENETICS';
const FORUM = '🐟・corydoras-research';
const GUIDE_TITLE = 'START HERE — Corydoras Research Index';
const TAGS = ['Research index','Named species','C-number','CW-number','Captive strain','Breeding','Taxonomy','ID / Lookalikes','Needs review'];
const ALLOW_MENTIONS = { parse: [] };
const RECEIPT_FILE = path.join(os.homedir(), 'AppData', 'Local', 'PixelNetwork', 'corydoras-research-receipts.jsonl');

// Match exact directory labels in the pinned 528-record source.
// Brochis arcuata and Gastrodermus napoensis are current combinations.
// This directory says Gastrodermus pauciradiatum, but other authorities
// prefer G. pauciradiatus: preserve source label and flag naming mismatch.
// Neither name spelling creates another species or breeding line.
export const PRIORITY_NAMES = [
  'Hoplisoma sterbai', 'Hoplisoma panda', 'Hoplisoma adolfoi', 'Hoplisoma duplicareum',
  'Hoplisoma weitzmanii', 'Hoplisoma schwartzi', 'Hoplisoma tukano', 'Hoplisoma julii',
  'Hoplisoma trilineatum', 'Hoplisoma paleatum', 'Hoplisoma habrosum', 'Hoplisoma simile',
  'Hoplisoma concolor', 'Hoplisoma melini', 'Brochis arcuata', 'Hoplisoma metae',
  'Gastrodermus napoensis', 'Hoplisoma gossei', 'Hoplisoma axelrodi', 'Hoplisoma leucomelas',
  'Osteogaster aenea', 'Osteogaster eques', 'Osteogaster melanotaenia',
  'Osteogaster sp. CW009', 'Osteogaster sp. CW010', 'Osteogaster sp. CW014',
  'Osteogaster sp. CW023', 'Brochis pantanalensis', 'Brochis splendens',
  'Brochis britskii', 'Brochis haraldschultzi', 'Brochis imitator',
  'Brochis leopardus', 'Brochis reticulata', 'Gastrodermus pygmaeus',
  'Gastrodermus hastatus', 'Gastrodermus elegans', 'Corydoras geoffroy',
  'Corydoras narcissus', 'Corydoras fowleri', 'Scleromystax barbatus',
  'Scleromystax kronei', 'Gastrodermus pauciradiatum',
  'Corydoras sp. CW128', 'Corydoras sp. CW207',
];
const LINEAGE_NOTE = {
  'Hoplisoma psamathos': 'The 2022 original description explicitly describes historical CW172 from the Rio Jamanxim, Tapajós basin as Corydoras psamathos, transferred in 2024 to Hoplisoma. CW172 is an alias for a described wild species, not a separate captive strain.',
  'Hoplisoma thanatos': 'The 2022 original description explicitly identifies historic CW146 as Corydoras thanatos, now Hoplisoma thanatos after 2024. Its resemblance to H. hypnos reflects wild mimicry, not a documented selective cross.',
  'Corydoras sp. CW173': 'Historical code CW173 = the species described in 2022 as Corydoras hypnos, currently Hoplisoma hypnos. Not an additional unique taxon or breeder-selected line.',
  'Corydoras sp. CW172': 'Historical code CW172 = described Hoplisoma psamathos (originally Corydoras psamathos, 2022). Retain code as a synonym/trade alias, not a distinct taxon.',
  'Corydoras sp. CW146': 'Historical CW146 = the species described in 2022 as Corydoras thanatos, now Hoplisoma thanatos. Not a distinct separate species count.',
  'Hoplisoma sp. CW111': 'Zebrina/Vulcan code CW111 remains a distinct unresolved form: the 2022 expedition did NOT find a specimen clearly matching its color pattern. Do not synonymize with hypnos, psamathos or thanatos.',
  'Hoplisoma hypnos': 'Described as Corydoras hypnos by Tencatt, Ohara, Sousa & Britto in 2022 from the rio Jamanxim (Tapajós drainage), Pará, Brazil; transferred to Hoplisoma in 2024. The paper discusses CW111 but does not establish it as a synonym of hypnos.',
  'Hoplisoma knaacki': 'Described by Tencatt & Evers in 2016, originally Corydoras knaacki; type locality is swamps near Santa Rita in the Inambari/Madre de Dios drainage, Peru. The species epithet is not evidence of a selected domestic strain founder.',
  'Hoplisoma parallelum': 'Historical Corydoras parallelus Burgess, 1993, C002 trade designation; original type locality Rio Içana, upper Rio Negro, Brazil. Distinct from lookalike larger two-line trade fish often called Super parallelus.',
  'Hoplisoma granti': 'Described in 2019 after resolving decades of Corydoras arcuatus trade-name confusion: C020 usually represents this species, while true C. arcuatus was associated with CW036. Do not treat either C/CW code as a captive-selected variety.',
  'Hoplisoma eversi': 'Formerly Corydoras eversi Tencatt & Britto, 2016. Current combination Hoplisoma eversi (2024 revision); the type locality is a tributary of the Rio Araguaia, Goiás, Brazil. Its eponym is not proof of a captive founder.',
  'Corydoras serratus': 'Sands, 1995; long-snouted wild species, type from Rio Poranga in the upper Rio Negro drainage, Amazonas, Brazil. Distinct from similarly banded masked cory species.',
  'Corydoras negro': 'Knaack, 2004. The name references the Río Negro of the Río Blanco system in Santa Cruz, Bolivia—not Brazil’s larger Rio Negro. This is a described wild species, not a domestically selected black morph.',
  'Corydoras septentrionalis': 'Gosline, 1940. Type locality Río Piña (Guarapiché system), Monagas, Venezuela; northern Orinoco tributaries. Do not confuse this locality with Amazon Rio Negro species.',
  'Corydoras fulleri': 'Formally described in 2021 from Peruvian rio Madeira tributaries; C115 and C116 represent the same highly variable species. The epithet honors Ian Fuller, who is not thereby established as the founder of a captive breed.',
  'Corydoras isaacisbrueckeri': 'Formally described in 2026 by Tencatt, Hercos, Carvalho, Santos & Britto from the rio Tefé basin, Brazil. Do not equate this described species with unidentified CW128 or CW207 without a specimen-level match.',
  'Corydoras sp. CW005': 'CW005 is the historical aquarium code for the described species Corydoras aurofrenatus (Eigenmann & Kennedy, 1903), according to the ScotCat specialist crosswalk; do not count the code as another distinct species.',
  'Corydoras aurofrenatus': 'Formally described species; historical CW005 / Corrientes trade code refers to the same fish, not a different species. Original type locality: Aguada near Arroyo Trementina, Paraguay (Eigenmann & Kennedy, 1903).',
  'Osteogaster oharai': 'Described in 2025 from the form previously designated CW068. Documented populations: rio Aripuanã (Madeira basin) and rio Juruena (Tapajós basin), Mato Grosso, Brazil. Distinctive oblique dark dorsolateral stripe.',
  'Osteogaster venezuelanus': 'TAXONOMY DISPUTED: Corydoras World lists this as a species, but Eschmeyer’s Catalog of Fishes currently treats the original C. venezuelanus as a synonym of O. aenea. This historical wild-origin name is NOT the captive-selected Black Venezuela line.',
  'Osteogaster schultzei': 'TAXONOMY UNCERTAIN: Eschmeyer’s Catalog of Fishes lists O. schultzei as uncertain; historically synonymized with O. aenea, with possible distinct status discussed. The commercially bred black schultzei-type strain is not itself a separate formal species.',
  'Hoplisoma sterbai': 'Sterba’s Cory; separate wild-type fish from any albino, black or longfin captive selections.',
  'Hoplisoma panda': 'Panda Cory; breeder-selected variants require independent parentage and inheritance evidence.',
  'Hoplisoma adolfoi': 'Upper Rio Negro orange-cap patterned species; compare with H. duplicareum and other mimics.',
  'Hoplisoma duplicareum': 'Distinguish from H. adolfoi using authoritative identification and source locality.',
  'Hoplisoma julii': 'True Julii identification often confused with H. trilineatum in the aquarium trade.',
  'Hoplisoma trilineatum': 'Three-line Cory; often incorrectly sold as true Julii.',
  'Hoplisoma habrosum': 'Salt-and-pepper dwarf Cory: genus Hoplisoma, not Gastrodermus.',
  'Gastrodermus pygmaeus': 'Pygmy Cory; distinct from the unrelated salt-and-pepper dwarf Cory.',
  'Gastrodermus hastatus': 'Tail-spot Cory; a separately described dwarf species.',
  'Osteogaster sp. CW009': 'Green Laser: numbered wild-origin identity; a selected Blue Laser line was reported from CW009 captive breeding.',
  'Osteogaster sp. CW010': 'Gold Laser: numbered identity; do not confuse the base population with a documented albino captive color morph.',
  'Osteogaster sp. CW014': 'Red Stripe code. Relationship to CW023 debated; preserve distinct historical code pending resolution.',
  'Osteogaster sp. CW023': 'Orange Stripe / Orange Laser code. Selected Red Laser offspring have been documented from CW023 breeding stock.',
  'Brochis pantanalensis': 'Pantanal Cory, historical C005; breeding coloration and sexual dimorphism merit separate coverage.',
  'Brochis haraldschultzi': 'Patterned Brochis often confused with Sterba’s Cory; require diagnostic comparison.',
  'Corydoras sp. CW128': 'UNRESOLVED coded form; the 2026 Tefé species description does NOT synonymize this with C. isaacisbrueckeri.',
  'Corydoras sp. CW207': 'UNRESOLVED coded form; the 2026 Tefé species description does NOT synonymize this with C. isaacisbrueckeri.'
};
const MORPHS = [
  {
    id:'morph-black-venezuela', name:'Black Venezuela / Black Cory',
    base:'Osteogaster aenea complex (schultzei-type captive line)',
    facts:'Captive-selected black line associated in specialist historical accounts with Hartmut Eberhardt in Germany in the early 1990s. "Venezuela" is an ambiguous trade name, not evidence this line was bred or collected there.',
    status:'Specialist historical account; taxon/early breeder provenance under review',
    sources:['https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/']
  },
  {
    id:'morph-blue-laser', name:'Blue Laser (CW009-selected)',
    base:'Osteogaster sp. CW009 Green Laser',
    facts:'Reported selectively bred blue phenotype derived from CW009 Green Laser stock by Ian Fuller. Do not treat as a separate named scientific species.',
    status:'Specialist breeder-history evidence; inheritance mechanism not established',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-red-laser', name:'Red Laser (CW023-selected)',
    base:'Osteogaster sp. CW023 Orange Stripe',
    facts:'A 2017 specialist account documents conspicuously red F2 offspring selectively reared from wild-origin CW023 stock. Preserve CW014 as a different historical code pending taxonomic reconciliation.',
    status:'Specialist breeder-history account; incomplete pedigree/genetics',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-albino-gold-laser', name:'Albino Gold Laser',
    base:'Osteogaster sp. CW010',
    facts:'An albino phenotype of Gold Laser has been reported in hobby breeder literature. Original creator, precise genetic mechanism and source stock are not verified here.',
    status:'Documented phenotype; lineage and genetics unverified',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-albino-sterbai', name:'Albino Sterbai',
    base:'Hoplisoma sterbai',
    facts:'Captive albino phenotype. Do not assign an invented breeder, origin date or simple inheritance ratio without breeding records.',
    status:'Captive trade morph; original provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/473']
  },
  {
    id:'morph-longfin-sterbai', name:'Longfin Sterbai',
    base:'Hoplisoma sterbai',
    facts:'Longfin trade phenotype: any assertion of a stable line, founder, or genotype must be supported by original breeder records.',
    status:'Trade morph claim; breed stability/provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/473']
  },
  {
    id:'morph-albino-bronze', name:'Albino Bronze Cory',
    base:'Osteogaster aenea complex',
    facts:'Captive pigment morph of bronze Cory stock; retain seller lineage and origin separately from the wild nominal species.',
    status:'Captive trade morph; first breeder/genetic locus not established',
    sources:['https://www.corydorasworld.com/lineages/fish/307']
  },
  {
    id:'morph-longfin-bronze', name:'Longfin Bronze Cory',
    base:'Osteogaster aenea complex',
    facts:'Longfin captive variant. The specific lineage and degree of fixation require individual breeder evidence.',
    status:'Captive trade morph; genetics/provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/307']
  },
];
function catalogFromSource(sourceText = null) {
  const text = sourceText ?? execFileSync('git',['-C',REPO,'show',SOURCE_SHA + ':' + SOURCE_PATH],{encoding:'utf8',maxBuffer:2_000_000});
  const re = /^\| ([^|]+) \| (Named taxon|C-coded|CW-coded) \| ([^|]+) \| \[CW source\]\((https:\/\/www\.corydorasworld\.com\/lineages\/fish\/\d+)\) \|$/gm;
  const all = [];
  const ids = new Set();
  for(const match of text.matchAll(re)) {
    const id=match[4].match(/\/(\d+)$/)[1];
    if(ids.has(id))throw new Error('Duplicate source record ID '+id);
    ids.add(id); all.push({ id, group:match[1],kind:match[2],name:match[3].trim(),source:match[4] });
  }
  if(all.length!==528)throw new Error('Expected 528 catalog entries, read '+all.length);
  return all;
}
function priorityRecords(catalog) {
  const byName=new Map(catalog.map(x=>[x.name.toLowerCase(),x]));
  const matches=[];
  const missing=[];
  for(const wanted of PRIORITY_NAMES) {
    const found=byName.get(wanted.toLowerCase());
    if(found) matches.push(found);
    else missing.push(wanted);
  }
  return {matches,missing};
}

// Dated-source discovery order, not a ranking by rarity or taxonomic confidence.
// Interleave source genera and named/C/CW record classes in bounded batches.
function nextCatalogBatch(catalog, occupiedNames, limit) {
  if(!Number.isInteger(limit)||limit<1||limit>80)throw new Error('Next batch size must be 1 to 80');
  const occupied=new Set([...occupiedNames].map(name=>String(name).trim().toLowerCase()));
  const seen=new Set();
  const groups=[...new Set(catalog.map(item=>item.group))];
  const kinds=['Named taxon','CW-coded','C-coded'];
  const pools=new Map();
  for(const group of groups){
    for(const kind of kinds){
      pools.set(group+'::'+kind,catalog.filter(item=>item.group===group&&item.kind===kind&&!occupied.has(item.name.toLowerCase())));
    }
  }
  const results=[];
  while(results.length<limit){
    let advanced=false;
    for(const kind of kinds){
      for(const group of groups){
        const item=pools.get(group+'::'+kind).shift();
        if(!item)continue;
        advanced=true;
        const key=item.name.toLowerCase();
        if(seen.has(key))throw new Error('Duplicate directory display label: '+item.name);
        seen.add(key);
        results.push(item);
        if(results.length>=limit)return results;
      }
    }
    if(!advanced)break;
  }
  return results;
}
function safe(s,limit=350){return String(s??'').replace(/@(here|everyone)/ig,'@\u200b$1').slice(0,limit);}
function kindTag(kind){return kind==='Named taxon'?'Named species':kind==='C-coded'?'C-number':'CW-number';}
function kindTagForRecord(rec){const m=rec.name.match(/\bsp\.?\s*(CW|C)\d+\b/i);return m?(m[1].toUpperCase()==='CW'?'CW-number':'C-number'):kindTag(rec.kind);}
const CONTESTED_NAMED_TAXA = new Set(['Osteogaster venezuelanus','Osteogaster schultzei']);
function nameClassification(rec){return rec.name==='Brochis Taiosh'?'Unverified directory name':CONTESTED_NAMED_TAXA.has(rec.name)?'Contested taxonomic status':kindTagForRecord(rec);}
// Only attach these species-specific assertions where traceable specialist or
// original taxonomic sources have been checked. Habitat data are NOT tank targets.
const SPECIES_EVIDENCE = {
  'Hoplisoma granti': [
    '**Taxonomy:** Originally described as Corydoras granti Tencatt, Lima & Britto (2019); 2024 phylogenomic revision uses Hoplisoma granti. Distinct from the true 1938 Corydoras arcuatus.',
    '**Trade-code crosswalk:** Decades of skunk-cory aquarium imports sold as C. arcuatus largely represent C020 = H. granti; true C. arcuatus is associated with CW036. Do not count C020 as a separate domesticated genetic strain.',
    '**Original type locality:** Igarapé Ya-Mirim (Iazinho), a Cauaburi tributary in the Rio Negro drainage near São Gabriel da Cachoeira, Amazonas, Brazil. Described range also spans western/central Amazon tributaries.',
    '**Wild habitat:** Known from both blackwater and turbid streams, sometimes alongside other corys. No validated spawning-water target.',
    '**Breeder pedigree:** No verified founder of a selected H. granti line or inherited trade-code phenotype from the taxonomic papers. Avoid attributing wild-species description to a commercial breeder.',
    '**Evidence:** https://www.fishbase.se/biblio/BiblioSummary.php?id=137973&speccode=71311&syncode=175776 ; https://www.sciencedirect.com/science/article/pii/S0044848621011236'
  ],
  'Hoplisoma eversi': [
    '**Taxonomy:** Described as Corydoras eversi Tencatt & Britto (2016), reclassified as Hoplisoma eversi in the 2024 phylogenomic revision. Eschmeyer currently lists the latter as valid.',
    '**Original provenance:** Unnamed stream tributary to Rio Araguaia, Montes Claros de Goiás, Goiás, Brazil; holotype MNRJ 43195. This scientific type locality does not prove the origin of any individual aquarium shipment.',
    '**Breeding and awards:** No verified captive selective-breeding founder, strain inheritance or competition record from the original taxonomic sources. Name honors a person; it is not proof of domestic breeding.',
    '**Sources:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=74221 ; https://doi.org/10.1093/zoolinnean/zlae053'
  ],
  'Corydoras serratus': [
    '**Formal identity:** Corydoras serratus Sands (1995), valid long-snouted Corydoras in Eschmeyer. Reported only from the upper Rio Negro basin, Brazil, in the cited catalog.',
    '**Type locality:** Rio Poranga, near Nobua oba, about 8 km north of the local confluence feeding the upper Rio Negro, Amazonas, Brazil. Holotype LIVCM 1994.4.38.',
    '**Identification caution:** Mask/dorsolateral markings may resemble other upper Negro fish; a photo alone cannot validate locality or lineage. Compare original diagnostic characters before claiming identity.',
    '**Breeding provenance:** No original domestic strain founder, inherited color-line pedigree, repeatable species-specific spawning regimen, or competition award established here.',
    '**Sources:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Corydoras&tbl=species ; https://www.gbif.org/species/2342783'
  ],
  'Corydoras negro': [
    '**Formal name:** Corydoras negro Knaack, 2004, valid in Eschmeyer’s Catalog of Fishes, described from Bolivia.',
    '**Type locality:** Río Negro in the Río Blanco drainage around Urubichá, Ñuflo de Chávez Province, Santa Cruz, eastern Bolivia. NOT the Brazilian Rio Negro. Holotype MTD F 28472.',
    '**Original distribution:** Blanco River / Guaporé–Iténez basin, Bolivia; reported size around 51 mm standard length. This is wild provenance, not proof of an imported aquarium lineage.',
    '**Breeding and traits:** No original captive line breeder, validated inheritance or species-specific spawning water parameters established in these sources.',
    '**Specialist and catalog sources:** https://www.planetcatfish.com/common/species.php?species_id=1896 ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?family=Callichthyidae&tbl=species'
  ],
  'Corydoras septentrionalis': [
    '**Formal name:** Corydoras septentrionalis Gosline, 1940, valid long-snouted species in the Catalog of Fishes.',
    '**Type locality:** Río Piña, 6 km north of Maturín, Guarapiché drainage, Monagas, Venezuela. Type specimen CAS-SU 35055. Regional distribution: Orinoco basin.',
    '**Biology (FishBase):** Reported stream-current habitat, facultative air breathing and adhesive-egg deposition. These are species-profile reports rather than evidence of a particular breeder-created strain.',
    '**Breeder and awards:** Commercial founder, full captive pedigree, exact genetically inherited varieties and contest awards not established here.',
    '**Sources:** https://www.fishbase.org/summary/SpeciesSummary.php?id=46227&lang=English ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Corydoras&tbl=species'
  ],
  'Corydoras fulleri': [
    '**Identity:** Tencatt et al. (2021), Journal of Fish Biology. Named for Ian Fuller; eponym ≠ captive breeder founder.',
    '**Historic code crosswalk:** Hobby C115 and C116 were identified as one variable species. Specialist keeper accounts cite German captive breeding in which different phenotypes arose among siblings; neither code identifies a distinct genetic species.',
    '**Original provenance:** Two río Manuripe tributaries and a tributary of río Madre de Dios, Madeira drainage, Peru, from original research. Distinguish scientific collection from captive farm provenance.',
    '**Identification:** Two caudal-fin-base blotches, specialized sensory-canal and branchial characters, variable flank band. See original diagnostic treatment rather than relying on color alone.',
    '**Breeding:** Specialist sources report captive breeding by 2005, but founder pedigree, inheritance loci, exact spawning method and awards remain unverified.',
    '**Sources:** https://pubmed.ncbi.nlm.nih.gov/33837549/ ; https://www.scotcat.com/callichthyidae/c_fulleri.htm ; https://www.aquariumglaser.de/en/fisharchive/corydoras-fulleri-c115-c116-2/'
  ],
  'Corydoras isaacisbrueckeri': [
    '**Formal description:** Tencatt, Hercos, Carvalho, Santos & Britto (2026), Neotropical Ichthyology 24(2): e250146; Eschmeyer’s Catalog of Fishes accepts this as a valid species.',
    '**Known locality:** Igarapé da ATM (type), igarapé da Barreira and igarapé do Pavão, rio Tefé basin, Amazonas, Brazil.',
    '**Diagnosis:** Dark eye mask and extended dark dorsal-base flank patch; confirm other fin, pattern and bone characters in the original description.',
    '**Field habitat:** Original collectors reported forest streams and marginal coarse yellow sandbars. One recorded dry-season sample had water temperature 25.6 C, pH 6.2 and conductivity 45.6 µS/cm; a single field sample is NOT a recommended aquarium range.',
    '**Breeder / founder:** No captive line founder or proven inherited selection trait documented in the original description.',
    '**C/CW provenance:** No verified CW128 or CW207 identification; keep codes unresolved.',
    '**Primary sources:** https://www.ni.bio.br/1982-0224-2025-0146/ ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=78599'
  ],
  'Corydoras aurofrenatus': [
    '**Names and lineage:** Original described name Corydoras aurofrenatus Eigenmann & Kennedy, 1903. CW005 and Corrientes are historical identification aliases, not separate taxa.',
    '**Origin and identification:** Type locality Aguada near Arroyo Trementina, Paraguay; long-snouted, with two dark flank blotches and an elongated upper caudal lobe.',
    '**Field / care:** Reported from the Paraguay–Paraná drainage. ScotCat suggests fine sand and a varied sinking diet; published species-specific breeding protocol is not confirmed here.',
    '**Taxonomic verification:** https://www.scotcat.com/callichthyidae/c_aurofrenatus.htm ; https://www.seriouslyfish.com/species/corydoras-aurofrenatus/ ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Corydoras&tbl=species'
  ],
  'Osteogaster oharai': [
    '**Names and lineage:** Described by Tencatt, Carvalho, Silva & Britto (2025), after previously appearing in the trade as CW068. CW068 is a historical alias, not a second new species.',
    '**Identity:** Oblique, dark dorsolateral flank stripe; the original description contrasts fin, bone and pigment characters with congeneric species.',
    '**Documented locality:** Rio Aripuanã drainage of the Madeira basin and rio Juruena drainage of the Tapajós basin, Mato Grosso, Brazil.',
    '**Habitat observed in the wild:** Small/shallow streams or intermittent pools with marginal vegetation, sand/clay, leaf litter, logs and dark water in the Juruena basin. These observations are NOT validated aquarium water targets.',
    '**Breeding / genealogy:** No named original captive-line breeder or proven strain inheritance from these sources; do not attribute wild scientific discovery to a hobby breeder.',
    '**Original description:** https://www.ni.bio.br/1982-0224-2024-0134/ ; https://www.scotcat.com/callichthyidae/osteogaster_oharai.htm'
  ],
  'Osteogaster venezuelanus': [
    '**Taxonomic conflict:** The 2026 Eschmeyer Catalog of Fishes currently treats Corydoras venezuelanus Ihering, 1911 as a synonym of Osteogaster aenea. Specialist Corydoras World and ScotCat retain the historical name as a distinguishable hobby population/species. Do not claim consensus validity.',
    '**Historic type locality:** Río Cabriales, Valencia, Carabobo, Venezuela (original name from Ihering, 1911). This locality does NOT describe the separately developed commercial black line.',
    '**Black-line distinction:** The captive selected Black Venezuela / schultzei-black trade line was developed in Germany; it should not be confused with wild orange-shouldered venezuelanus-type populations.',
    '**Evidence:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=4920 ; https://www.scotcat.com/callichthyidae/osteogaster_venezuelanus.htm ; https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/'
  ],
  'Osteogaster schultzei': [
    '**Taxonomic conflict:** The Eschmeyer Catalog labels the original schultzei species status uncertain; historically synonymized with Osteogaster aenea but discussed as potentially valid. Never count it as a confidently distinct named species without taxonomic review.',
    '**Captive trait distinction:** The domestically selected black schultzei-type line is a separate strain-history question; specialist Ian Fuller reports early 1990s German line selection by Hartmut Eberhardt.',
    '**Evidence:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Osteogaster&tbl=species ; https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/'
  ]
};
function sourcePacket(rec) {
  const extra=rec.name.includes('CW128')||rec.name.includes('CW207')
    ? '\n**2026 original taxonomy:** https://doi.org/10.1590/1982-0224-2025-0146'
    : rec.name==='Corydoras sp. CW005'
      ? '\n**CW005 crosswalk:** https://www.scotcat.com/callichthyidae/c_aurofrenatus.htm'
      : '';
  const directoryWarning=rec.name==='Brochis Taiosh'
    ? 'Source directory label is not a validated Latin binomial; its formal species or trade identity remains unresolved.'
    : /^(Osteogasters|Hoplisomas|Hoplisoms|Holisoma|Brochiss|Gastrdermus) /.test(rec.name)
      ? 'Source directory has a genus spelling inconsistency (likely typo). Retain the raw label for traceability; any corrected genus needs independent nomenclatural validation.'
      : '';
  const note=LINEAGE_NOTE[rec.name] || 'Taxonomy, type locality, local population, captive pedigree, and breeding data require record-level review.';
  return {
    content: [
      '**' + safe(rec.name,100) + '**',
      '**Classification:** ' + nameClassification(rec) + ' | **Research genus group:** ' + safe(rec.group,30),
      ...(directoryWarning?['**Naming caution:** ' + directoryWarning]:[]),
      '**Status:** Research draft / verification pending. A C/CW identifier is NOT necessarily a different species or domestic strain.',
      '**Identity / notes:** ' + safe(note,350),
      '**Breeder / founder:** Not established from this index.',
      '**Care / breeding:** Species-specific parameters not yet independently validated unless documented directly below.',
      ...(SPECIES_EVIDENCE[rec.name] ?? []),
      ...breedingEvidenceLines(rec.name),
      '**Source record:** ' + rec.source + extra,
      '**Aquapedia dossier:** ' + PR_URL
    ].join('\n'),
    embeds:[{title:safe(rec.name,100),description:'Aquapedia provisional catalog entry; do not interpret unresolved taxonomy or trade identity as proven genetics.',footer:{text:'AQP-CORY-' + rec.id + ' • research draft'}}],
    allowedMentions: ALLOW_MENTIONS,
  };
}
function morphPacket(rec) {
  return {
    content:[
      '**' + safe(rec.name,100) + '**',
      '**Record type:** Captive morph / selected line (not automatically a scientific species).',
      '**Underlying fish:** ' + rec.base,
      '**What is documented:** ' + rec.facts,
      '**Evidence status:** ' + rec.status,
      '**Breeding / genetics:** Original pedigree and inheritance must be independently checked unless explicitly documented above.',
      ...morphAuditLines(rec.id),
      '**Sources:** ' + rec.sources.join(' '),
      '**Aquapedia dossier:** ' + PR_URL
    ].join('\n'),
    embeds:[{title:safe(rec.name,100),description:'Captive form record, with founder/parentage claims clearly bounded.',footer:{text:'AQP-CORY-' + rec.id + ' • research draft'}}],
    allowedMentions: ALLOW_MENTIONS
  };
}
function guidePacket(catalog) {
  const csv = ['group,classification,name,source'].concat(catalog.map(r=>[r.group,r.kind,r.name,r.source].map(x=>'"'+x.replaceAll('"','""')+'"').join(','))).join('\r\n');
  return {
    content:[
      '**Corydoras Research — master index (2026-10-16 snapshot)**',
      '528 specialist-directory listings: 219 named labels, 112 C-number listings and 197 CW-number listings. These are **not** 528 confirmed species or domestic strains.',
      'One forum post per researched fish or captive morph; tags distinguish species, coded forms, and breeder-selected traits. Research drafts are not final taxonomy.',
      '**What each entry needs:** current and historical names, identity and diagnostic photos, basin/locality, genetics/lineage where known, water/husbandry and breeding methods, breeder origin, confidence and independent citations.',
      '**Research dossier / source crosswalk:** ' + SOURCE_URL,
      '**Draft review:** ' + PR_URL,
      '**Copyright:** No third-party fish photography or articles republished without documented permission. No private source-server links.',
      'The attached CSV contains all 528 initial source entries; threads are seeded only as findings are reviewed.'
    ].join('\n'),
    files:[new AttachmentBuilder(Buffer.from(csv,'utf8'),{name:'aquapedia-corydoras-public-index-528.csv'})],
    embeds:[{title:'Corydoras Research — START HERE',description:'Species and strain research, taxonomy notes, C/CW identities and breeding evidence.',footer:{text:'AQP-CORY-master-index-528 • research draft'}}],
    allowedMentions:ALLOW_MENTIONS
  };
}

const EVIDENCE_THREAD_TITLE = 'Corydoradinae Evidence Desk - Eight Research Areas';
const EVIDENCE_THREAD_ID = 'evidence-eight-topics-20261019';
function evidencePacket(){
  const content=[
    '**Aquapedia Corydoradinae: eight evidence topics (19 October 2026)**',
    '**Research draft — not a new species count, not a DNA-confirmed pedigree, and not a care prescription.**',
    '1. **Taxonomy:** 2024 seven-genera revision and 2025 species-epithet correction. Old Corydoras names remain useful search aliases.',
    '2. **Localities:** original museum/type drainages, not assumed source of every aquarium specimen.',
    '3. **Reproduction:** the sperm-drinking/T-position mechanism was studied in bronze cory; avoid species-wide extrapolation.',
    '4. **Genetics:** a 288-fish bronze-cory behavior study did not test the DNA loci or dominance of domestic color morphs.',
    '5. **Lookalikes:** similar markings can reflect mimicry; species identification needs diagnostic evidence.',
    '6. **Health:** venomed fin-spine evidence supports cautious handling; barbel injury has multiple possible causes.',
    '7. **Conservation:** check dated IUCN assessments and country-specific law; old statuses are not current surveys.',
    '8. **Breeders:** named firsthand spawning reports do not prove founder pedigrees, show championships, or photo rights.',
    '**Primary source links:**',
    'Taxonomy + correction: https://doi.org/10.1093/zoolinnean/zlae053 | https://doi.org/10.1093/zoolinnean/zlaf035',
    'Breeding: https://doi.org/10.1007/BF00002344',
    'Behavior: https://www.sciencedirect.com/science/article/pii/S0168159124000534',
    'Mimicry: https://doi.org/10.1038/nature09660',
    'Breeder index: https://www.scotcat.com/articles/articles_breeding.htm',
    '**Publisher policy:** Link, cite and credit; do not rehost copyrighted breeder/journal images. More source verification pending.'
  ].join('\n');
  if(content.length>2000)throw new Error('Evidence update exceeds Discord 2000-character limit');
  return {content,embeds:[{title:'Corydoradinae: Eight Evidence Areas',description:'Source-linked research summary, provisional. Scientific species, C/CW codes, and selected morphs are distinct record types.',footer:{text:'AQP-CORY-'+EVIDENCE_THREAD_ID+' • research draft'}}],allowedMentions:ALLOW_MENTIONS};
}
// Public forum only: no permission mutation and never recreate a deleted forum.
function requirePublic(ch,guildId){
  const everyone=ch.permissionOverwrites.cache.get(guildId);
  if(everyone?.deny.has(PermissionFlagsBits.ViewChannel))
    throw new Error('Public Aquapedia channel denies @everyone ViewChannel: '+ch.name);
}
async function ensureChannel(guild, sourceCategory) {
  const list=[...guild.channels.cache.values()];
  const categories=list.filter(c=>c.type===ChannelType.GuildCategory && c.name===CATEGORY);
  if(categories.length!==1||categories[0].id!==sourceCategory.id)
    throw new Error('Public Aquapedia category not uniquely matched; refusing publication');
  requirePublic(sourceCategory,guild.id);
  const everyoneRole=guild.roles?.everyone;
  if(everyoneRole && !everyoneRole.permissions.has(PermissionFlagsBits.ViewChannel))
    throw new Error('Guild @everyone lacks ViewChannel');
  const forumCandidates=list.filter(c=>c.type===ChannelType.GuildForum && c.name===FORUM);
  if(forumCandidates.length!==1||forumCandidates[0].parentId!==sourceCategory.id)
    throw new Error('Existing public Corydoras research forum not found under Aquapedia');
  const forum=forumCandidates[0];
  requirePublic(forum,guild.id);
  if(forum.permissionOverwrites.cache.size!==0)
    throw new Error('Corydoras forum permissions differ from public Aquapedia category; refusing publication');
  return {category:sourceCategory,forum};
}
async function allThreads(forum) {
  const active=await forum.threads.fetchActive();
  const found=new Map([...active.threads.values()].map(x=>[x.name,x]));
  let before=null;
  for(let page=0;page<25;page++){
    const archive=await forum.threads.fetchArchived(before?{limit:100,before}:{limit:100});
    for(const thread of archive.threads.values()){
      if(found.has(thread.name)&&found.get(thread.name).id!==thread.id)throw new Error('Duplicate thread title: '+thread.name);
      found.set(thread.name,thread);
    }
    if(!archive.hasMore)return found;
    const oldest=[...archive.threads.values()].at(-1);
    if(!oldest?.archivedAt || (before && oldest.archivedAt >= before))throw new Error('Archived thread pagination blocked');
    before=oldest.archivedAt;
  }
  throw new Error('Archived forum search exceeded 25 pages; fail closed');
}
function tagIds(forum,names) {
  return names.map(name=>forum.availableTags.find(t=>t.name===name)?.id).filter(Boolean);
}
async function post(forum,recordKey,name,payload,tags,known,botId,kind) {
  const thread=known.get(name);
  const marker='AQP-CORY-' + recordKey;
  if(thread){
    const starter=await thread.fetchStarterMessage();
    if(starter?.author?.id !== botId || !starter.embeds.some(e=>e.footer?.text?.startsWith(marker))){
      throw new Error('Existing thread title is not safely owned by this publisher: '+name);
    }
    return {action:'already-present',recordKey,threadId:thread.id,messageId:starter.id};
  }
  const created=await forum.threads.create({name,message:payload,appliedTags:tagIds(forum,tags),reason:'User-approved Aquapedia Corydoras research'});
  const starter=await created.fetchStarterMessage();
  if(!starter?.id || starter.author.id!==botId || !starter.embeds.some(e=>e.footer?.text?.startsWith(marker))){
    throw new Error('Discord write cannot be confirmed; stop for recovery audit: '+name);
  }
  known.set(name,created);
  fs.mkdirSync(path.dirname(RECEIPT_FILE),{recursive:true});
  fs.appendFileSync(RECEIPT_FILE,JSON.stringify({at:new Date().toISOString(),sourceSha:SOURCE_SHA,guildId:forum.guild.id,forumId:forum.id,kind,recordKey,threadId:created.id,messageId:starter.id,verified:true})+'\n');
  return {action:'posted',recordKey,threadId:created.id,messageId:starter.id};
}
// Permit a bounded correction to a bot-owned research starter post without duplicating it.
async function refreshRecord(forum, threads, rec, botId, receiptFile=RECEIPT_FILE, packetFactory=sourcePacket) {
  const thread=threads.get(rec.name);
  if(!thread)throw new Error('Cannot refresh missing research thread: '+rec.name);
  const marker='AQP-CORY-'+rec.id;
  const starter=await thread.fetchStarterMessage();
  if(!starter?.id||starter.author?.id!==botId||!starter.embeds?.some(e=>e.footer?.text?.startsWith(marker)))
    throw new Error('Research source ownership/marker mismatch; refusing edit: '+rec.name);
  const payload=packetFactory(rec);
  if(payload.content.length>2000)throw new Error('Corydoras revision exceeds Discord message limit');
  const changed=starter.content!==payload.content;
  if(changed)await starter.edit(payload);
  const readback=await thread.messages.fetch({message:starter.id,force:true});
  if(readback?.author?.id!==botId||readback.content!==payload.content||!readback.embeds?.some(e=>e.footer?.text?.startsWith(marker)))
    throw new Error('Refresh readback failed. Stop before retry: '+rec.name);
  let tagChanged=false;
  if(CONTESTED_NAMED_TAXA.has(rec.name)){
    const desired=tagIds(forum,['Taxonomy','Needs review']);
    if(desired.length!==2)throw new Error('Contested taxon tags missing from forum; refusing metadata edit');
    const current=[...(thread.appliedTags??[])];
    if(desired.length!==current.length||desired.some(id=>!current.includes(id))){
      if(typeof thread.setAppliedTags!=='function')throw new Error('Missing forum thread tag edit permission');
      await thread.setAppliedTags(desired,'Mark contested Corydoras taxonomy as research only');
      tagChanged=true;
    }
    const checked=await thread.fetch(true);
    if(!desired.every(id=>checked.appliedTags?.includes(id))||checked.appliedTags.length!==desired.length)
      throw new Error('Contested taxon tags could not be verified after edit: '+rec.name);
  }
  const contentHash=createHash('sha256').update(readback.content).digest('hex');
  let alreadyReceipted=false;
  if(fs.existsSync(receiptFile)){
    const raw=fs.readFileSync(receiptFile,'utf8');
    alreadyReceipted=raw.split(/\r?\n/).filter(Boolean).some(line=>{
      const previous=JSON.parse(line);
      return previous.kind==='revision'&&previous.recordKey===rec.id&&previous.threadId===thread.id&&previous.contentHash===contentHash&&previous.verified===true;
    });
  }
  if(!alreadyReceipted||tagChanged){
    fs.mkdirSync(path.dirname(receiptFile),{recursive:true});
    fs.appendFileSync(receiptFile,JSON.stringify({at:new Date().toISOString(),action:changed?'updated':tagChanged?'retagged':'reconciled',tagChanged,contentHash,sourceSha:SOURCE_SHA,guildId:forum.guild.id,forumId:forum.id,kind:'revision',recordKey:rec.id,threadId:thread.id,messageId:readback.id,verified:true})+'\n');
  }
  return {action:changed?'updated':tagChanged?'retagged':alreadyReceipted?'unchanged':'reconciled',recordKey:rec.id,threadId:thread.id,messageId:readback.id,verified:true};
}

async function main() {
  const mode=process.argv.includes('--apply')?'apply':'plan';
  const evidenceOnly=process.argv.includes('--evidence-only');
  const nextFlag=process.argv.find(a=>a.startsWith('--next='));
  const refreshFlag=process.argv.find(a=>a.startsWith('--refresh-id='));
  const morphRefreshFlag=process.argv.find(a=>a.startsWith('--refresh-morph-id='));
  const refreshId=refreshFlag?.split('=')[1]??null;
  if(evidenceOnly && (refreshFlag||nextFlag||morphRefreshFlag||process.argv.includes('--pin-guide'))) throw new Error('Evidence update is a standalone one-writer operation');
  if(morphRefreshFlag && (refreshFlag||nextFlag||!MORPHS.some(x=>x.id===morphRefreshFlag.split('=')[1])))
    throw new Error('--refresh-morph-id requires one known captive morph, and no competing writer flags');
  if(refreshFlag && (!/^[0-9]+$/.test(refreshId)||nextFlag))
    throw new Error('--refresh-id requires a numerical source ID and cannot accompany --next');
  const nextCount=nextFlag?Number(nextFlag.split('=')[1]):null;
  if(nextFlag && (!Number.isInteger(nextCount)||nextCount<1||nextCount>80))
    throw new Error('--next must contain 1 to 80 unpublished directory records');
  const limitFlag=process.argv.find(a=>a.startsWith('--limit='));
  const limit=limitFlag?Number(limitFlag.split('=')[1]):36;
  if(!Number.isInteger(limit)||limit<0||limit>80)throw new Error('--limit must be between 0 and 80');
  const guildId=process.env.AQUAPHORIA_GUILD_ID;
  const token=process.env.DISCORD_TOKEN;
  if(!guildId||!token)throw new Error('Existing authorized Discord bot configuration is missing');
  const catalog=catalogFromSource(), selected=priorityRecords(catalog);
  const client=new Client({intents:[GatewayIntentBits.Guilds]});
  client.rest.setToken(token);
  try{
    const user=await client.rest.get('/users/@me');
    client.user=new ClientUser(client,user);
    const guild=await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    const sources=[...guild.channels.cache.values()].filter(c=>c.type===ChannelType.GuildCategory && c.name===SOURCE_CATEGORY);
    if(sources.length!==1)throw new Error('Exact public Aquapedia category not found unambiguously');
    requirePublic(sources[0],guild.id);
    const target=await ensureChannel(guild,sources[0]);
    console.log(JSON.stringify({mode,guildId:guild.id,botId:user.id,category:target.category?.name||'(would create)',forum:target.forum?.name||'(would create)',sourceCount:catalog.length,priorityMatched:selected.matches.length,priorityMissing:selected.missing,uniqueMorphs:MORPHS.length,plannedPosts:evidenceOnly?1:(process.argv.includes('--pin-guide')?0:((refreshFlag||morphRefreshFlag)?1:(nextFlag?nextCount:Math.min(limit,selected.matches.length)+MORPHS.length+1)))}));
    if(mode==='plan'&&!nextFlag&&!refreshFlag&&!morphRefreshFlag&&!evidenceOnly)return;
    const forum=target.forum;
    if(!forum)throw new Error('No forum returned after provisioning');
    const existing=await allThreads(forum);
    if(evidenceOnly){
      const packet=evidencePacket();
      const current=existing.get(EVIDENCE_THREAD_TITLE);
      console.log(JSON.stringify({kind:'corydoras-evidence',mode,existing:Boolean(current),forumId:forum.id,contentLength:packet.content.length}));
      if(mode==='plan')return;
      const result=current
        ? await refreshRecord(forum,existing,{id:EVIDENCE_THREAD_ID,name:EVIDENCE_THREAD_TITLE},user.id,RECEIPT_FILE,()=>packet)
        : await post(forum,EVIDENCE_THREAD_ID,EVIDENCE_THREAD_TITLE,packet,['Research index','Taxonomy','Needs review'],existing,user.id,'evidence');
      console.log(JSON.stringify({status:'evidence-sync',...result,verified:result.verified===true||result.action==='posted',forumId:forum.id}));
      return;
    }

    const nextSelection=nextFlag?nextCatalogBatch(catalog,new Set(existing.keys()),nextCount):[];
    if(nextFlag)console.log(JSON.stringify({nextBatchPreview:nextSelection.map(r=>({name:r.name,kind:r.kind,source:r.source})),selectionCount:nextSelection.length,existingThreads:existing.size}));
    const refreshRec=refreshFlag?catalog.find(r=>r.id===refreshId):null;
    const morphRefreshRec=morphRefreshFlag?MORPHS.find(r=>r.id===morphRefreshFlag.split('=')[1]):null;
    if(refreshFlag) {
      if(!refreshRec)throw new Error('Unknown directory ID: '+refreshId);
      if(!existing.has(refreshRec.name))throw new Error('Target thread not found: '+refreshRec.name);
      console.log(JSON.stringify({refreshPreview:{id:refreshRec.id,name:refreshRec.name,source:refreshRec.source}}));
    }
    if(morphRefreshRec){
      if(!existing.has(morphRefreshRec.name))throw new Error('Existing morph thread not found: '+morphRefreshRec.name);
      console.log(JSON.stringify({morphRefreshPreview:{id:morphRefreshRec.id,name:morphRefreshRec.name}}));
    }
    if(mode==='plan')return;
    if(morphRefreshRec){
      console.log(JSON.stringify(await refreshRecord(forum,existing,morphRefreshRec,user.id,RECEIPT_FILE,morphPacket)));
      return;
    }
    if(refreshRec){
      console.log(JSON.stringify(await refreshRecord(forum,existing,refreshRec,user.id)));
      return;
    }
    if(process.argv.includes('--pin-guide')) {
      const guide=existing.get(GUIDE_TITLE);
      if(!guide)throw new Error('Research master index thread does not exist');
      const starter=await guide.fetchStarterMessage();
      if(starter?.author?.id!==user.id || !starter.embeds.some(e=>e.footer?.text?.startsWith('AQP-CORY-master-index-528')))
        throw new Error('Cannot pin guide without validated bot-authored index');
      if(!guide.flags.has(ChannelFlags.Pinned))await guide.pin('Keep the Aquapedia Corydoras source index discoverable');
      const confirmed=await client.channels.fetch(guide.id,{force:true});
      if(!confirmed?.flags.has(ChannelFlags.Pinned))throw new Error('Guide pin could not be verified');
      console.log(JSON.stringify({status:'guide-pinned',threadId:guide.id,forumId:forum.id,verified:true}));
      return;
    }
    let posted=0,present=0;
    const choices=nextFlag
      ? nextSelection.map(rec=>({key:rec.id,name:rec.name,payload:sourcePacket(rec),tags:[rec.name==='Brochis Taiosh'||CONTESTED_NAMED_TAXA.has(rec.name)?'Taxonomy':kindTagForRecord(rec),'Needs review'],kind:'directory'}))
      : [
        {key:'master-index-528',name:GUIDE_TITLE,payload:guidePacket(catalog),tags:['Research index','Taxonomy'],kind:'index'},
        ...selected.matches.slice(0,limit).map(rec=>({key:rec.id,name:rec.name,payload:sourcePacket(rec),tags:[kindTagForRecord(rec),'Needs review'],kind:'directory'})),
        ...MORPHS.map(rec=>({key:rec.id,name:rec.name,payload:morphPacket(rec),tags:['Captive strain','Needs review'],kind:'morph'})),
      ];
    for(const item of choices){
      const receipt=await post(forum,item.key,item.name,item.payload,item.tags,existing,user.id,item.kind);
      if(receipt.action==='posted')posted++;else present++;
      console.log(JSON.stringify(receipt));
    }
    console.log(JSON.stringify({status:'completed',posted,present,forumId:forum.id,categoryId:target.category.id,receiptFile:RECEIPT_FILE}));
  } finally { client.destroy(); }
}
if(import.meta.url===new URL('file://' + process.argv[1].replaceAll('\\','/')).href){
  main().catch(error=>{console.error('STOP',error?.message||String(error));process.exitCode=1;});
}
export {catalogFromSource,priorityRecords,nextCatalogBatch,sourcePacket,morphPacket,guidePacket,evidencePacket,refreshRecord,ensureChannel,TAGS,MORPHS};
