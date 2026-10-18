// Guild-wide public forum capacity guard. No writes or automatic archiving.
// This reserves 50 of Discord's 1,000 active guild-thread slots for other activity.
export const PUBLIC_THREAD_SOFT_LIMIT = 950;
export async function probePublicThreadCapacity(guild,{softLimit=PUBLIC_THREAD_SOFT_LIMIT}={}){
  if (!Number.isInteger(softLimit)||softLimit<1||softLimit>1000)throw new RangeError('Invalid soft limit');
  if(typeof guild?.channels?.fetchActiveThreads!=='function'){
    return {allowed:false,reason:'guild_active_thread_probe_unavailable',count:null,softLimit};
  }
  try{
    const active=await guild.channels.fetchActiveThreads(false);
    const count=active?.threads?.size;
    if(!Number.isInteger(count)||count<0||count>1000){
      return {allowed:false,reason:'guild_active_thread_count_invalid',count:null,softLimit};
    }
    return {allowed:count<softLimit,reason:count>=softLimit?'guild_active_thread_soft_limit':'capacity_available',count,softLimit};
  }catch{
    return {allowed:false,reason:'guild_active_thread_probe_failed',count:null,softLimit};
  }
}
