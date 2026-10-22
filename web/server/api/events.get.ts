// Server-sent events for the logged-in user: judging results, queue and cheat
// detection changes (staff), new notifications.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const stream = createEventStream(event)
  const unsubscribe = liveSubscribe(({ event: e, audience }) => {
    if (liveVisibleTo(audience, user))
      stream.push({ event: e.type, data: JSON.stringify(e) }).catch(() => {})
  })
  // A periodic ping keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => stream.push({ event: 'ping', data: '{}' }).catch(() => {}), 25_000)
  stream.onClosed(async () => {
    clearInterval(heartbeat)
    unsubscribe()
    await stream.close()
  })
  // Pushing before send() would wait for a reader that does not exist yet.
  setTimeout(() => stream.push({ event: 'ready', data: '{}' }).catch(() => {}), 0)
  return stream.send()
})
