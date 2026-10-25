import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLineagePost, validateLineageManifest } from '../src/medaka-lineage-publisher.mjs';
const sourced={
 slug:'lecris-unlimited',name:'Lecris Unlimited',
 site_url:'https://aquapedia.app/medakapedia/strains/lecris-unlimited/',
 evidence_state:'breeder_or_publication_reported',
 parents_or_stages:['Lecris','Tsuki no Hibiki × Kujaku Ao EVO'],
 source_title:'Mai Medaka first-person breeder account',
 source_url:'https://ameblo.jp/mai-medaka/entry-12824388220.html',
 claim_limits:'Reported stock input; no genetic genotype proof.',
 existing_picture_discord_message_url:'https://discord.com/channels/1519337502379475095/1561210349406126220/1561231823407816817'
};
test('renders original breeder source, caution and forum backlink in both publication destinations',()=>{
 const output=formatLineagePost(sourced,{forumUrl:'https://discord.com/channels/1519337502379475095/1561210349406126220',indexUrl:'https://discord.com/channels/1519337502379475095/1569999999999999999'});
 assert.match(output,/Mai Medaka/);
 assert.match(output,/ameblo.jp/);
 assert.match(output,/no genetic genotype proof/);
 assert.match(output,/1561210349406126220/);
 assert.match(output,/1569999999999999999/);
 assert.match(output,/AQUAPEDIA-MEDAKA-LINEAGE-V2:lecris-unlimited/);
});
test('unknown lineage lists Aquapedia dossier as source but never claims parentage',()=>{
 const output=formatLineagePost({...sourced,slug:'unknown-example',source_url:null,source_title:'Aquapedia strain dossier (no verified parent-line source)',parents_or_stages:[],evidence_state:'parentage_undocumented'});
 assert.match(output,/Parent lines not documented/);
 assert.doesNotMatch(output,/https:\/\/ameblo.jp/);
});
test('rejects duplicate slugs and invalid original source URLs',()=>{
 const manifest={schema_version:1,trees:[sourced,sourced]};
 assert.throws(()=>validateLineageManifest(manifest),/Duplicate/);
 assert.throws(()=>validateLineageManifest({schema_version:1,trees:[{...sourced,source_url:'http://insecure.example'}]}),/HTTPS/);
});
