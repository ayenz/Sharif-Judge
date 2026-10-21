const GUEST_ONLY = ['/login', '/register', '/lost', '/install']

export default defineNuxtRouteMiddleware(async (to) => {
  const isPublic = GUEST_ONLY.includes(to.path) || to.path.startsWith('/reset/')
  const { me, loaded, refresh } = useMe()
  if (!loaded.value)
    await refresh()
  if (!me.value && !isPublic)
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} })
  if (me.value && GUEST_ONLY.includes(to.path))
    return navigateTo('/')
  if (me.value && typeof to.meta.minLevel === 'number' && me.value.level < to.meta.minLevel)
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
})

declare module '#app' {
  interface PageMeta {
    /** Minimum permission level: 1 instructor, 2 head instructor, 3 admin. */
    minLevel?: number
  }
}
