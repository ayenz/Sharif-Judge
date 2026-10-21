<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Install' })

const { data: status } = await useFetch('/api/install')
const done = ref(false)
const state = reactive({ username: '', email: '', password: '', passwordAgain: '' })
const { submit, loading, error } = useApiForm('/api/install', state, { onSuccess: () => (done.value = true) })
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">
        Install SharIF Judge
      </h1>
      <p class="text-sm text-muted">
        Creates the database tables and the first admin account.
      </p>
    </div>
    <UAlert v-if="status?.installed && !done" color="info" variant="subtle" icon="i-lucide-info" title="SharIF Judge is already installed." />
    <div v-else-if="done" class="space-y-4">
      <UAlert color="success" variant="subtle" icon="i-lucide-circle-check" title="Installed" description="Sign in with the admin account, then review the paths in Settings." />
      <UButton to="/login" block label="Go to sign in" />
    </div>
    <template v-else>
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
      <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
        <UFormField label="Admin username" name="username" required>
          <UInput v-model="state.username" class="w-full" />
        </UFormField>
        <UFormField label="Admin email" name="email" required>
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>
        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField label="Confirm password" name="passwordAgain" required>
          <UInput v-model="state.passwordAgain" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" label="Install" />
      </UForm>
    </template>
  </div>
</template>
