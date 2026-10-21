<script setup lang="ts">
import type { Ace } from 'ace-builds'

// Read-only, syntax highlighted code (Ace, loaded on demand).
const props = defineProps<{ code: string, language?: string }>()
const host = useTemplateRef<HTMLDivElement>('host')
const colorMode = useColorMode()
let viewer: Ace.Editor | undefined

onMounted(async () => {
  const ace = await loadAce()
  viewer = ace.edit(host.value!, {
    readOnly: true,
    showPrintMargin: false,
    highlightActiveLine: false,
    fontSize: '13px',
    maxLines: 40,
    minLines: 6,
  })
  viewer.setTheme(aceTheme(colorMode.value === 'dark'))
  viewer.session.setMode(aceModeFor(props.language ?? ''))
  viewer.setValue(props.code, -1)
})
watch(() => props.code, code => viewer?.setValue(code, -1))
watch(() => colorMode.value, mode => viewer?.setTheme(aceTheme(mode === 'dark')))
onBeforeUnmount(() => viewer?.destroy())
</script>

<template>
  <div ref="host" class="w-full rounded-md border border-default overflow-hidden" />
</template>
