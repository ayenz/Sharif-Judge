<script setup lang="ts">
// Monospace textarea where Tab inserts a tab; Esc toggles that (legacy taboverride behaviour).
const model = defineModel<string>({ default: '' })
defineProps<{ rows?: number, disabled?: boolean, placeholder?: string }>()

const tabIndent = ref(true)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    tabIndent.value = !tabIndent.value
    return
  }
  if (e.key !== 'Tab' || !tabIndent.value || e.shiftKey)
    return
  e.preventDefault()
  const el = e.target as HTMLTextAreaElement
  const { selectionStart: s, selectionEnd: end } = el
  model.value = `${model.value.slice(0, s)}\t${model.value.slice(end)}`
  nextTick(() => el.setSelectionRange(s + 1, s + 1))
}
</script>

<template>
  <UTextarea
    v-model="model"
    :rows="rows ?? 10"
    :disabled="disabled"
    :placeholder="placeholder"
    autoresize
    :maxrows="30"
    spellcheck="false"
    class="w-full"
    :ui="{ base: 'font-mono text-xs leading-relaxed [tab-size:4]' }"
    @keydown="onKeydown"
  />
</template>
