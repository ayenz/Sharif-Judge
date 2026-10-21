<script setup lang="ts">
// Problems of the selected assignment (legacy /problems).
const { me } = useMe()
const assignmentId = computed(() => me.value?.selectedAssignment.id ?? 0)
</script>

<template>
  <AppPage title="Problems" icon="i-lucide-file-text">
    <ProblemView v-if="assignmentId" :assignment-id="assignmentId" :problem-id="1" />
    <UEmpty
      v-else
      icon="i-lucide-folder-search"
      title="No assignment selected."
      description="Select an assignment to see its problems."
      :actions="[{ label: 'Go to assignments', to: '/assignments', icon: 'i-lucide-folder-open' }]"
    />
  </AppPage>
</template>
