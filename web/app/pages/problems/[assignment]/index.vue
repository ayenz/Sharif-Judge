<script setup lang="ts">
// /problems/<assignment> shows problem 1, like the legacy route.
const route = useRoute()
const assignmentId = computed(() => Number(route.params.assignment) || 0)
</script>

<template>
  <AppPage title="Problems" icon="i-lucide-file-text">
    <ProblemView :assignment-id="assignmentId" :problem-id="1" />
  </AppPage>
</template>
