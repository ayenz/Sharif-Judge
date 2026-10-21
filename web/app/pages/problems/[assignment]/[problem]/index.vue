<script setup lang="ts">
const route = useRoute()
const assignmentId = computed(() => Number(route.params.assignment) || 0)
const problemId = computed(() => Number(route.params.problem) || 0)
</script>

<template>
  <AppPage title="Problems" icon="i-lucide-file-text">
    <ProblemView :assignment-id="assignmentId" :problem-id="problemId" />
  </AppPage>
</template>
