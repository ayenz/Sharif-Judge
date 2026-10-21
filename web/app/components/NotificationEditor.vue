<script setup lang="ts">
// Title + rich text (HTML) form for a notification. Loaded lazily (<LazyNotificationEditor>)
// so the Tiptap editor is only downloaded on the add/edit pages.
import type { EditorToolbarItem } from '@nuxt/ui'

const props = defineProps<{ id?: number, title?: string, text?: string }>()

const toast = useToast()
const state = reactive({ title: props.title ?? '', text: props.text ?? '' })
const mode = ref<'rich' | 'html'>('rich')

const items: EditorToolbarItem[][] = [
  [{ kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: 'Undo' } }, { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: 'Redo' } }],
  [{
    icon: 'i-lucide-heading',
    tooltip: { text: 'Headings' },
    content: { align: 'start' },
    items: [
      { kind: 'paragraph', icon: 'i-lucide-pilcrow', label: 'Paragraph' },
      { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
      { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
      { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
    ],
  }],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: 'Code' } },
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bullet list' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } },
    { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } },
    { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: 'Code block' } },
  ],
  [
    { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Link' } },
    { kind: 'clearFormatting', icon: 'i-lucide-remove-formatting', tooltip: { text: 'Clear formatting' } },
  ],
]

const { submit, loading, error } = useApiForm(
  () => (props.id ? `/api/notifications/${props.id}` : '/api/notifications'),
  state,
  {
    method: props.id ? 'PUT' : 'POST',
    onSuccess: async () => {
      toast.add({ title: props.id ? 'Notification saved.' : 'Notification added.', color: 'success', icon: 'i-lucide-check' })
      await navigateTo('/notifications')
    },
  },
)
</script>

<template>
  <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
    <UFormField label="Title" name="title">
      <UInput v-model="state.title" maxlength="200" dir="auto" class="w-full" size="lg" />
    </UFormField>

    <UFormField name="text">
      <template #label>
        <div class="flex items-center gap-2">
          <span>Text</span>
        </div>
      </template>
      <template #hint>
        <UFieldGroup size="xs">
          <UButton :color="mode === 'rich' ? 'primary' : 'neutral'" :variant="mode === 'rich' ? 'soft' : 'ghost'" icon="i-lucide-type" label="Rich text" @click="mode = 'rich'" />
          <UButton :color="mode === 'html' ? 'primary' : 'neutral'" :variant="mode === 'html' ? 'soft' : 'ghost'" icon="i-lucide-code-xml" label="HTML" @click="mode = 'html'" />
        </UFieldGroup>
      </template>
      <div v-if="mode === 'rich'" class="rounded-md border border-default focus-within:border-primary transition-colors">
        <UEditor
          v-slot="{ editor }"
          v-model="state.text"
          content-type="html"
          placeholder="Write the notification…"
          class="w-full min-h-64"
          :ui="{ base: 'prose-content px-4 py-3 sm:px-4 min-h-64' }"
        >
          <UEditorToolbar :editor="editor" :items="items" class="border-b border-default px-2 py-1 overflow-x-auto" />
        </UEditor>
      </div>
      <UTextarea
        v-else
        v-model="state.text"
        :rows="14"
        autoresize
        :maxrows="30"
        spellcheck="false"
        class="w-full"
        :ui="{ base: 'font-mono text-xs' }"
      />
    </UFormField>
    <p class="text-xs text-muted -mt-2">
      The rich text editor keeps basic formatting only. Use the HTML view for markup it does not support (colors, alignment, tables).
    </p>

    <div class="flex gap-2">
      <UButton type="submit" :loading="loading" icon="i-lucide-save" :label="id ? 'Save' : 'Add notification'" />
      <UButton to="/notifications" color="neutral" variant="ghost" label="Cancel" />
    </div>
  </UForm>
</template>
