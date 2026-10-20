import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import path from 'node:path';
import {
  buildMedaka79Index, verifyMedaka79PublishedMessages,
  MEDAKA79_FORUM_ID, MEDAKA79_SITE_URL, MEDAKA79_STARTER_MARKER,
} from '../src/medaka79-research-index.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bytes=readFileSync(path.join(root,'resources/aquapedia-medaka79-20261020.json'));
const source=JSON.parse(bytes);

test('source-linked 79-record Medaka index stays distinct from authenticated strains', () => {
  const p=buildMedaka79Index(source,{rawSource:bytes});
  assert.equal(p.records,79);
  assert.deepEqual(p.counts,{A:23,B:40,C:16});
  assert.equal(p.parts.length,10);
  assert.equal(p.parts.reduce((n,x)=>n+x.count,0),79);
  assert.equal(p.forumId,MEDAKA79_FORUM_ID);
  assert.equal(p.websiteUrl,MEDAKA79_SITE_URL);
  assert.equal(p.approvalRequired,true);
  assert.equal(p.status,'PROPOSED_FOR_APPROVED_PUBLISHER_ONLY');
  assert.deepEqual(p.photographs,[]);
  assert.deepEqual(p.allowedMentions,{parse:[]});
  assert.equal(p.sourceSha256,'5e15684e2059f94a1c4c3c47ba67d723ec5b98ce13097efcf546bdd428e6e7f0');
  assert.equal(p.parts.length,new Set(p.parts.map(x=>x.marker)).size);
  assert.ok(p.parts.every(x=>x.content.length<1901));
  assert.ok(p.parts.every(x=>/Research only/.test(x.content)));
  assert.ok(p.starter.includes(MEDAKA79_STARTER_MARKER));
  for(const record of source.records){
    const appearances=p.parts.filter(part=>part.content.includes(record.primary_source_url));
    assert.ok(appearances.length>=1,record.id+' missing source URL');
  }
});

test('source fingerprint is stable across Windows CRLF and Git LF checkouts', () => {
  const lf=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
  const crlf=Buffer.from(lf.toString('utf8').replace(/\n/g,'\r\n'),'utf8');
  const clean=buildMedaka79Index(JSON.parse(lf),{rawSource:lf});
  const windows=buildMedaka79Index(JSON.parse(crlf),{rawSource:crlf});
  assert.equal(clean.sourceSha256,'5e15684e2059f94a1c4c3c47ba67d723ec5b98ce13097efcf546bdd428e6e7f0');
  assert.equal(windows.sourceSha256,clean.sourceSha256);
});

test('index rejects changes in research evidence tiers, image rights and pedigree claims',()=>{
  for(const [field,value] of [
    ['photo_rights','permission_granted'],
    ['authenticated_standalone_bloodline',true],
    ['requires_independent_review',false],
    ['commercial_genotype','AA'],
    ['dominance','dominant'],
  ]){
    const altered=structuredClone(source);
    altered.records[0][field]=value;
    assert.throws(()=>buildMedaka79Index(altered),/improperly upgraded/);
  }
  const wrong=structuredClone(source);wrong.records[0].primary_source_url='http://example.com/fish';
  assert.throws(()=>buildMedaka79Index(wrong),/Unapproved or unsafe/);
  const rootUrl=structuredClone(source);rootUrl.records[0].primary_source_url='https://medakazukan.net/';
  assert.throws(()=>buildMedaka79Index(rootUrl),/Unapproved or unsafe/);
  const duplicate=structuredClone(source);duplicate.records[1].id=duplicate.records[0].id;
  assert.throws(()=>buildMedaka79Index(duplicate),/duplicate Medaka/);
});

test('no publication is claimed without every authenticated Discord readback',()=>{
  const plan=buildMedaka79Index(source);
  const botId='777';
  const expected=[plan.starter,...plan.parts.map(p=>p.content)];
  const messages=expected.map((content,i)=>({id:String(9000+i),content,author:{id:botId}}));
  assert.equal(verifyMedaka79PublishedMessages(plan,[],botId),false);
  assert.equal(verifyMedaka79PublishedMessages(plan,messages,botId),true);
  const added=structuredClone(messages);added[1].content='PREFACE\n'+added[1].content;
  assert.equal(verifyMedaka79PublishedMessages(plan,added,botId),false);
  const markerOnly=structuredClone(messages);markerOnly[1].content=plan.parts[0].marker;
  assert.equal(verifyMedaka79PublishedMessages(plan,markerOnly,botId),false);
  assert.equal(verifyMedaka79PublishedMessages(plan,messages.slice(0,-1),botId),false);
  const fake=structuredClone(messages);fake[1].author.id='attacker';
  assert.equal(verifyMedaka79PublishedMessages(plan,fake,botId),false);
  const missing=structuredClone(messages);missing[1].content='missing source marker';
  assert.equal(verifyMedaka79PublishedMessages(plan,missing,botId),false);
  const replay=structuredClone(messages);replay[1].id=replay[2].id;
  assert.equal(verifyMedaka79PublishedMessages(plan,replay,botId),false);
});

test('forum posts never contain unsafe role pings or unauthorized imagery',()=>{
  const p=buildMedaka79Index(source);
  const contents=[p.starter,...p.parts.map(x=>x.content)].join('\n');
  assert.doesNotMatch(contents,/@everyone|@here|<@&|<img|\.jpg|\.png/i);
  assert.match(contents,/parents.*unknown|undocumented origins/);
  assert.match(contents,/NOT 79 newly authenticated/);
});
