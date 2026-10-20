import test from 'node:test';
import assert from 'node:assert/strict';
import {ChannelType} from 'discord.js';
import {layoutDefinition, provisionAquaphoriaLayout} from '../src/layout.mjs';

function existingAquapediaLayoutFixture() {
  const layout=layoutDefinition(),all=[],edits=[],permissionChanges=[],creations=[];
  const roles=[
    {id:'staff-role',name:'Aquaphoria Staff'},
    {id:'vendor-role',name:'Verified Aquaphoria Vendor'},
    {id:'member-role',name:'Aquaphoria Member'}
  ];
  const roleCache={
    get:id=>roles.find(x=>x.id===id),
    filter:predicate=>{const found=roles.filter(predicate);return {size:found.length,first:()=>found[0]}}
  };
  const every={id:'everyone-role'};
  for(const section of layout){
    const category={
      id:section.categoryId ?? 'category:'+section.category,name:section.category,type:ChannelType.GuildCategory,
      permissionsFor:()=>({has:()=>true}),
      permissionOverwrites:{set:async()=>permissionChanges.push('category:'+section.category)}
    };
    all.push(category);
    for(const [name,topic] of section.channels){
      all.push({
        id:'text:'+name,parentId:category.id,name,type:ChannelType.GuildText,topic,
        setTopic:async()=>{throw Error('Unexpected topic rewrite '+name)},
        permissionOverwrites:{set:async()=>permissionChanges.push('text:'+name)}
      });
    }
    for(const spec of section.forums??[]){
      const forum={
        id:spec.id ?? 'forum:'+spec.name,parentId:category.id,name:spec.name,type:ChannelType.GuildForum,
        topic:spec.topic,
        permissionsFor:()=>({has:()=>true}),
        availableTags:spec.tags.map(x=>({id:'tag:'+spec.name+':'+x.name,...x})),
        permissionOverwrites:{set:async()=>permissionChanges.push('forum:'+spec.name)},
        async edit(options,reason) {
          edits.push({name:spec.name,reason,options});
          this.topic=options.topic;
          this.availableTags=options.availableTags;
          return this;
        }
      };
      all.push(forum);
    }
  }
  const guild={
    roles:{everyone:every,cache:roleCache,async create(){throw Error('Unexpected role creation')}},
    members:{cache:new Map([['owner-user',{user:{id:'owner-user'}}]])},
    channels:{
      cache:{find:predicate=>all.find(predicate),filter:predicate=>({size:all.filter(predicate).length})},
      async create(options){creations.push(options);throw Error('Unexpected channel creation: '+options.name)}
    }
  };
  return {guild,layout,all,edits,permissionChanges,creations};
}

test('whole-layout provisioning reuses live magazine forums and exact issue tag IDs without new channels or public permission rewrites',async()=>{
  const f=existingAquapediaLayoutFixture();
  const watched=['🗞️・magazines-and-articles','📖・medaka-hyakka','📘・medaka-advance','🦐・shrimp-club','🐟・medaka-trip'];
  const originals=new Map(f.all.filter(x=>watched.includes(x.name)).map(x=>[
    x.name,{id:x.id,tags:new Map(x.availableTags.map(t=>[t.name,t.id]))}
  ]));
  const result=await provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'});
  assert.deepEqual(f.creations,[]);
  const returned=result.channels.filter(x=>watched.includes(x.channel));
  assert.equal(returned.length,5);
  for(const name of watched){
    const before=originals.get(name);
    const after=f.all.find(x=>x.name===name);
    assert.equal(after.id,before.id,name+' ID changed');
    assert.equal(returned.find(x=>x.channel===name)?.id,before.id,name+' receipt changed');
    assert.deepEqual(new Map(after.availableTags.map(t=>[t.name,t.id])),before.tags,name+' tags replaced');
    assert.equal(f.edits.some(x=>x.name===name),false,name+' existing live metadata should not be rewritten');
    assert.equal(f.permissionChanges.includes('forum:'+name),false,name+' public overwrites mutated');
  }
  assert.ok(f.permissionChanges.some(x=>x.startsWith('forum:📚・translated-publications')),'existing private forum policy still enforced');
  assert.equal(f.permissionChanges.some(x=>x==='category:📚・AQUAPEDIA'),false,'public category overwrites mutated');
});

test('repeating provisionAquaphoriaLayout preserves all four issue forums and tags (idempotent second pass)',async()=>{
  const f=existingAquapediaLayoutFixture();
  await provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'});
  const countBefore=f.all.length;
  const ids=new Map(f.all.filter(x=>/medaka-hyakka|medaka-advance|shrimp-club|medaka-trip/.test(x.name))
    .map(x=>[x.name,x.availableTags.map(t=>t.id)]));
  await provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'});
  assert.equal(f.all.length,countBefore);
  assert.deepEqual(f.creations,[]);
  for(const [name,tags] of ids)assert.deepEqual(f.all.find(x=>x.name===name).availableTags.map(t=>t.id),tags);
});

test('magazine forum provisioning does not silently drop a moderator-added tag',async()=>{
  const f=existingAquapediaLayoutFixture();
  const forum=f.all.find(x=>x.name==='📖・medaka-hyakka');
  forum.availableTags.push({id:'moderator-tag-1',name:'Editorial Review',moderated:false});
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*tags|tag.*drift/i
  );
  assert.equal(forum.availableTags.some(x=>x.id==='moderator-tag-1'),true);
  assert.equal(f.edits.some(x=>x.name===forum.name),false);
  assert.deepEqual(f.creations,[]);
});

test('magazine provisioning refuses a conflicting forum with the same name outside public Aquapedia',async()=>{
  const f=existingAquapediaLayoutFixture();
  f.all.push({id:'hidden-duplicate',name:'📘・medaka-advance',type:ChannelType.GuildForum,parentId:'private-category'});
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*collision|duplicate.*magazine/i
  );
  assert.deepEqual(f.creations,[]);
  assert.equal(f.edits.some(x=>x.name==='📘・medaka-advance'),false);
});

test('magazine provisioning refuses a forum made private rather than changing its public access',async()=>{
  const f=existingAquapediaLayoutFixture();
  const forum=f.all.find(x=>x.name==='🦐・shrimp-club');
  forum.permissionsFor=()=>({has:()=>false});
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*public|forum.*public/i
  );
  assert.deepEqual(f.creations,[]);
  assert.equal(f.permissionChanges.includes('forum:'+forum.name),false);
});


test('commerce-only layout reuse ignores magazine drift without changing the issue forums',async()=>{
  const f=existingAquapediaLayoutFixture();
  const pub=f.all.find(x=>x.name==='📖・medaka-hyakka');
  const original=pub.availableTags.map(x=>x.id);
  pub.availableTags.push({id:'editorial-existing-tag',name:'Editorial Review',moderated:false});
  await assert.rejects(()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),/magazine.*tags|tag.*drift/i);
  f.edits.length=0;
  const result=await provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user',includePublicMagazines:false});
  assert.ok(result.roles.staffRoleId);
  assert.equal(result.channels.some(x=>x.channel==='🦐・shrimp-research'),false,'commerce does not rewrite protected research');
  assert.equal(result.channels.some(x=>x.channel==='📖・medaka-hyakka'),false);
  assert.deepEqual(pub.availableTags.map(x=>x.id),[...original,'editorial-existing-tag']);
  assert.equal(f.edits.some(x=>x.name==='📖・medaka-hyakka'),false);
  assert.deepEqual(f.creations,[]);
});


test('magazine setup rejects two forums with same title inside the public category without editing either',async()=>{
  const f=existingAquapediaLayoutFixture();
  const original=f.all.find(x=>x.name==='📖・medaka-hyakka');
  f.all.push({
    ...original,
    id:'shadow-magazine-forum',
    availableTags:original.availableTags.map(x=>({...x})),
    async edit(){throw Error('A second same-category magazine forum must never be edited')}
  });
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*duplicate|duplicate.*magazine|magazine.*collision/i
  );
  assert.equal(f.edits.some(x=>x.name===original.name),false);
  assert.deepEqual(f.creations,[]);
});


test('owner setup refuses a missing live magazine forum instead of recreating an empty replacement',async()=>{
  const f=existingAquapediaLayoutFixture();
  const name='📖・medaka-hyakka';
  const current=f.all.findIndex(x=>x.name===name);
  assert.ok(current>=0);
  f.all.splice(current,1);
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*missing|missing.*magazine/i
  );
  assert.deepEqual(f.creations,[],'must not call Discord channel creation for a lost live magazine forum');
});


test('owner setup validates all protected magazines before any other layout writes',async()=>{
  const f=existingAquapediaLayoutFixture();
  const idx=f.all.findIndex(x=>x.name==='📖・medaka-hyakka');
  assert.ok(idx>=0);
  f.all.splice(idx,1);
  await assert.rejects(
    ()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),
    /magazine.*missing|missing.*magazine/i
  );
  assert.deepEqual(f.edits,[], 'failed magazine preflight must not edit a different channel first');
  assert.deepEqual(f.permissionChanges,[], 'failed magazine preflight must not change private or public permission overwrites');
  assert.deepEqual(f.creations,[], 'failed magazine preflight must not create any channel');
});

test('owner preflight fails closed on wrong canonical species category ID',async()=>{
  const f=existingAquapediaLayoutFixture();
  const cat=f.all.find(x=>x.name==='🧬・AQUAPEDIA — SPECIES & GENETICS');
  cat.id='unexpected-species-category';
  await assert.rejects(()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),/category.*missing|category.*duplicated/i);
  assert.deepEqual(f.creations,[]);
  assert.deepEqual(f.edits,[]);
  assert.deepEqual(f.permissionChanges,[]);
});

test('owner preflight fails closed on changed historical forum ID',async()=>{
  const f=existingAquapediaLayoutFixture();
  f.all.find(x=>x.name==='🐟・corydoras-research').id='replaced-forum';
  await assert.rejects(()=>provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'}),/forum ID drift/i);
  assert.deepEqual(f.creations,[]);
  assert.deepEqual(f.permissionChanges,[]);
});

test('moderator tag reorder preserves IDs without metadata writes',async()=>{
  const f=existingAquapediaLayoutFixture();
  const target=f.all.find(x=>x.name==='📖・medaka-hyakka');
  const before=new Map(target.availableTags.map(t=>[t.name,t.id]));
  target.availableTags.reverse();
  await provisionAquaphoriaLayout(f.guild,{ownerUserId:'owner-user'});
  assert.deepEqual(new Map(target.availableTags.map(t=>[t.name,t.id])),before);
  assert.equal(f.edits.some(x=>x.name===target.name),false);
  assert.deepEqual(f.creations,[]);
});
