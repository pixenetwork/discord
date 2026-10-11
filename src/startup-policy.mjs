export function startupPolicy({ prelaunch = false } = {}) {
  const publish = !prelaunch;
  return Object.freeze({
    provisionTranslatedForum: publish,
    registerGuildCommands: publish,
    registerGpt: publish,
  });
}
