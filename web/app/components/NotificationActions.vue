<script setup lang="ts">
// Edit / delete controls for a notification (head instructors and admins).
const props = defineProps<{ id: number, title: string, size?: 'xs' | 'sm' }>()
const emit = defineEmits<{ deleted: [id: number] }>()

const toast = useToast()
const open = ref(false)
const loading = ref(false)

async function remove() {
  loading.value = true
  try {
    await $fetch(`/api/notifications/${props.id}`, { method: 'DELETE' })
    toast.add({ title: 'Notification deleted.', color: 'success', icon: 'i-lucide-check' })
    open.value = false
    emit('deleted', props.id)
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5 shrink-0">
    <UTooltip text="Edit">
      <UButton :to="`/notifications/${id}/edit`" icon="i-lucide-pencil" color="neutral" variant="ghost" :size="size ?? 'sm'" aria-label="Edit notification" />
    </UTooltip>
    <UTooltip text="Delete">
      <UButton icon="i-lucide-trash-2" color="error" variant="ghost" :size="size ?? 'sm'" aria-label="Delete notification" @click="open = true" />
    </UTooltip>
    <UModal v-model:open="open" title="Delete notification" :ui="{ footer: 'justify-end' }">
      <template #body>
        <p class="text-sm">
          Are you sure you want to delete <strong dir="auto">{{ title || 'this notification' }}</strong>?
        </p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="ghost" label="Cancel" @click="open = false" />
        <UButton color="error" icon="i-lucide-trash-2" label="Delete" :loading="loading" @click="remove" />
      </template>
    </UModal>
  </div>
</template>
