export default defineEventHandler(async () => {
  return { installed: await tableExists('settings') }
})
