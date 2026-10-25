<script setup lang="ts">
// Cloudflare Turnstile security check for the sign-in, registration and password-reset forms.
// Rendered only when the server sends a site key (see server/utils/turnstile.ts). The token is
// single-use: call reset() after each submit.
const props = defineProps<{ siteKey: string }>()
const token = defineModel<string>({ default: '' })

const el = useTemplateRef<HTMLDivElement>('el')
const colorMode = useColorMode()
const failed = ref('')
let widgetId: string | undefined

onMounted(async () => {
  try {
    const turnstile = await loadTurnstile()
    if (!el.value)
      return
    widgetId = turnstile.render(el.value, {
      'sitekey': props.siteKey,
      'theme': colorMode.value === 'dark' ? 'dark' : 'light',
      'size': 'flexible',
      'callback': (value: string) => (token.value = value),
      'expired-callback': () => (token.value = ''),
      'error-callback': () => {
        token.value = ''
      },
    })
  }
  catch (e) {
    failed.value = (e as Error).message
  }
})

onBeforeUnmount(() => {
  if (widgetId)
    loadTurnstile().then(t => t.remove(widgetId!)).catch(() => {})
})

function reset() {
  token.value = ''
  if (widgetId)
    loadTurnstile().then(t => t.reset(widgetId)).catch(() => {})
}
defineExpose({ reset })
</script>

<template>
  <div>
    <div ref="el" class="min-h-[65px]" />
    <p v-if="failed" class="text-sm text-error">
      {{ failed }}. Check your connection and reload the page.
    </p>
  </div>
</template>
