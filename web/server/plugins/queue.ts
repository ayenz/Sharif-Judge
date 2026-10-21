// Resume judging after a restart: a crash may have left queue_is_working at 1
// and items in the queue.
export default defineNitroPlugin(() => {
  if (import.meta.prerender || !useRuntimeConfig().queue.enabled)
    return
  setTimeout(async () => {
    try {
      if (!(await tableExists('queue')))
        return
      await setSetting('queue_is_working', '0')
      queueKick()
    }
    catch (error) {
      console.warn('[queue] startup check failed:', (error as Error).message)
    }
  }, 2000)
})
