/**
 * Source-presence audit, NOT a credibility/copyright/claim verification.
 * Never scrapes private sites or follows linked third-party documents.
 */
const reject=reason=>{throw Error('Citation audit: '+reason)};
const ignoredDomains=new Set([
 'aquapedia.app','www.aquapedia.app','discord.com','www.discord.com',
 'static.cloudflareinsights.com','cloudflareinsights.com',
 'www.instagram.com','instagram.com','www.facebook.com','facebook.com',
 'www.youtube.com','youtube.com','youtu.be','twitter.com','x.com'
]);
export function collectAquapediaCitationLinks(pageUrl,html){
 let parsed;try{parsed=new URL(pageUrl);}catch{reject('invalid site URL');}
 if(parsed.protocol!=='https:'||parsed.hostname!=='aquapedia.app'||
  parsed.search||parsed.username||parsed.password||
  !/^\/(?:guppypedia\/entries|plecopedia\/research|corydoraspedia\/(?:breeding|lineages))\//.test(parsed.pathname))
  reject('unexpected source URL shape');
 if(typeof html!=='string'||!html.trim())reject('empty/untrusted source HTML');
 let area=html;
 if(parsed.hash){
  if(!/^#[a-z0-9-]+$/.test(parsed.hash)||!parsed.pathname.startsWith('/corydoraspedia/'))
   reject('invalid section anchor');
  const escaped=parsed.hash.slice(1);
  const anchorRe=new RegExp('<article\\b[^>]*\\bid\\s*=\\s*["\\x27]'+escaped+'["\\x27][^>]*>', 'i');
  const match=anchorRe.exec(html);
  if(!match)reject('source anchor missing on live page');
  const begin=match.index;
  const closing=html.indexOf('</article>',begin);
  if(closing<0)reject('source article section malformed');
  area=html.slice(begin,closing+10);
 }
 const out=new Set();
 for(const m of area.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'<>]+)["'][^>]*>/gi)){
  const raw=m[1].replace(/&amp;/g,'&');
  let url;try{url=new URL(raw,pageUrl);}catch{continue;}
  if(url.protocol!=='https:'||ignoredDomains.has(url.hostname.toLowerCase()))continue;
  if(url.username||url.password)continue;
  out.add(url.href);
 }
 return {url:pageUrl,sourceScope:parsed.hash?'anchor-local':'full-public-article',
  links:[...out].sort(),externalCitationCount:out.size,
  claimVerified:false,mediaRightsVerified:false};
}
