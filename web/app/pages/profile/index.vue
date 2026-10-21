<script setup lang="ts">
const { me } = useMe()
</script>

<template>
  <AppPage title="Profile" icon="i-lucide-user">
    <ProfileForm v-if="me" :user-id="me.id" />
  </AppPage>
</template>
