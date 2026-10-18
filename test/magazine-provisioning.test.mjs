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
      id:'category:'+section.category,name:section.category,type:ChannelType.GuildCategory,
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
        id:'forum:'+spec.name,parentId:category.id,name:spec.name,type:ChannelType.GuildForum,
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
      cache:{find:predicate=>all.find(predicate)},
      async create(options){creations.push(options);throw Error('Unexpected channel creation: '+options.name)}
    }
  };
  return {guild,layout,all,edits,permissionChanges,creations};
}

test('whole-layout provisioning reuses live magazine forums and exact issue tag IDs without new channels or public permission rewrites',async()=>{
  const f=existingAquapediaLayoutFixture();
  const watched=['magazines-and-articles','📖・medaka-hyakka','📘・medaka-advance','🦐・shrimp-club','🐟・medaka-trip'];
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
