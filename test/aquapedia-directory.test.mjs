import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaDirectory, DIRECTORY_MARKER, pinRoute } from '../src/aquapedia-directory.mjs';

const GUILD='1519337502379475095';
const category={id:'cat',type:4,name:'📚・AQUAPEDIA',permission_overwrites:[]};
const library={id:'lib',type:4,name:'📚・AQUAPHORIA LIBRARY',permission_overwrites:[]};
const privateCategory={id:'secret',type:4,name:'🔬・BREEDER RESEARCH',permission_overwrites:[{id:GUILD,deny:'1024',allow:'0'}]};
const child=(id,name,type=0,parent_id='cat',permission_overwrites=[])=>({id,name,type,parent_id,permission_overwrites});
const channels=[category,library,privateCategory,
 child('hub','📚・aquapedia'),child('med','🐟・medaka-guides'),child('shr','🦐・shrimp-guides'),
 child('cory','🐟・corydoras-research',15),child('pleco','🐟・pleco-research',15),
 child('genes','shrimp-genes',15),child('mag','magazines-and-articles',15),
 child('care','🩺・care-help'),child('private','private-breeder',15,'secret'),
 child('genetics','🧬・genetics-lineage',0,'lib')];
const roles=[{id:GUILD,permissions:'1024'}];

test('directory links only verified public Aquapedia destinations and preserves stable IDs',()=>{
 const result=buildAquapediaDirectory({guildId:GUILD,channels,roles});
 assert.equal(result.hubId,'hub');
 assert.match(result.content,new RegExp(DIRECTORY_MARKER.replace(/[[\]{}()*+?.\\^$|]/g,'\\$&')));
 for(const id of ['med','shr','cory','pleco','genes','mag','care'])assert.ok(result.content.includes('/'+id+'>'),id);
 for(const id of ['private','genetics'])assert.ok(!result.content.includes('/'+id+'>'),id);
 assert.ok(result.content.length<=2000);
 assert.ok(result.targetIds.length>=7);
});

test('required research destinations fail closed if private or missing',()=>{
 const blocked=channels.map(c=>c.id==='genes'?{...c,permission_overwrites:[{id:GUILD,allow:'0',deny:'1024'}]}:c);
 assert.throws(()=>buildAquapediaDirectory({guildId:GUILD,channels:blocked,roles}),/not public|missing/i);
 assert.throws(()=>buildAquapediaDirectory({guildId:GUILD,channels:channels.filter(x=>x.id!=='cory'),roles}),/missing/i);
 assert.throws(()=>buildAquapediaDirectory({guildId:GUILD,channels,roles:[{id:GUILD,permissions:'0'}]}),/public/i);
});

test('duplicate research targets fail rather than silently choosing the wrong forum',()=>{
 const doubled=[...channels,child('cory2','🐟・corydoras-research',15)];
 assert.throws(()=>buildAquapediaDirectory({guildId:GUILD,channels:doubled,roles}),/ambiguous/i);
});

test('pin uses Discord current channel pins route',()=>{
 assert.equal(pinRoute('hub','message'),'/channels/hub/pins/message');
});
