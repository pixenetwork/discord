/**
 * Discord-native Aquapedia post presentation. Safe for existing Jarvis
 * source-delta publisher; no media copied; original claim strings retained.
 */
const markerRE=/\[AQUAPEDIA-[^\]]+\]/g;
const safeUrl=s=>/^https:\/\/[a-z0-9.-]+\//i.test(s)&&!/[<>@"']/g.test(s);
const shorten=(s,n)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
export function renderAquapediaCard(raw,{channel='research'}={}){
 const marker=Array.from(raw.matchAll(markerRE)).at(-1)?.[0];
 if(!marker)throw Error('Missing durable Aquapedia marker');
 const lines=raw.replace(markerRE,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const head=(lines.shift()||'Aquapedia research').replace(/^\*\*|\*\*$/g,'');
 const fields=[],other=[];
 for(const line of lines){
  const match=line.match(/^\*\*([^*]{2,100}):\*\*\s*(.*)$/);
  if(match)fields.push({label:match[1],value:match[2]});
  else other.push(line);
 }
 const subject=fields.find(x=>/^(name|topic|breeder)$/i.test(x.label));
 const sources=fields.flatMap(x=>Array.from(x.value.matchAll(/https:\/\/[^\s<>]+/g),m=>m[0]));
 const url=sources.find(x=>safeUrl(x)&&x.startsWith('https://aquapedia.app/'))
   ||sources.find(safeUrl);
 const slug=url?new URL(url).pathname.split('/').filter(Boolean).at(-1)||'research':'';
 const humanSlug=slug.replace(/[-_]+/g,' ').replace(/\b[a-z]/g,x=>x.toUpperCase());
 const title=subject&&/SOURCE-CHECKED|RESEARCH ENTRY|SOURCE-LINKED|BREEDER SOURCE-SYNC/i.test(head)?subject.value:
  /NEWLY PUBLISHED RESEARCH PAGE/i.test(head)&&url?'📚 '+humanSlug+' · research':head;
 const summary=fields.find(x=>/^(scope|documented research|summary)$/i.test(x.label));
 const description=[...other,summary?.value||''].filter(Boolean).join('\n');
 const color=/shrimp/i.test(channel)?0xe85d6a:/breeder/i.test(channel)?0x8b80e8:0x4296e8;
 const embed={title:shorten(title,250),color};
 if(url)embed.url=url;
 if(description)embed.description=shorten(description,3900);
 const labelMap={'Full research and sources':'🔗 Full article & references',
 'Read original report and sources':'🔗 Full article & references',
 'Verified public page':'🔗 Original article','Research status':'Review status',
 'Research limits':'⚠️ Evidence limits','Important':'⚠️ Attribution note',
 'Notice':'⚠️ Research note','Media':'Photo rights'};
 const visible=fields.filter(x=>x!==summary&&x.value).map(x=>({
  name:shorten(labelMap[x.label]||x.label,240),
  value:shorten(x.value.replace(/https:\/\/[^\s<>]+/g,u=>safeUrl(u)?'[Open original ↗]('+u+')':u),980),
  inline:false
 }));
 if(visible.length>25)throw Error('Too many research fields');
 if(visible.length)embed.fields=visible;
 embed.footer={text:'Aquapedia • Original claims, evidence qualifiers and photo rights retained'};
 if(JSON.stringify(embed).length>5800)throw Error('Research embed over size limit');
 return {content:'||'+marker+'||',embeds:[embed],flags:0,allowed_mentions:{parse:[]}};
}