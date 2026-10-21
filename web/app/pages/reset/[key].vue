<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Set new password' })

const route = useRoute()
const key = String(route.params.key)
const { error: linkError } = await useFetch('/api/auth/reset', { method: 'POST', body: { key } })

const done = ref(false)
const state = reactive({ key, password: '', passwordAgain: '' })
const { submit, loading, error } = useApiForm('/api/auth/reset', state, { onSuccess: () => (done.value = true) })
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-lg font-semibold">
      Set a new password
    </h1>
    <UAlert v-if="linkError" color="error" variant="subtle" icon="i-lucide-link-2-off" :title="apiError(linkError).message" />
    <UAlert v-else-if="done" color="success" variant="subtle" icon="i-lucide-circle-check" title="Your password has been changed." />
    <template v-else>
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
      <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
        <UFormField label="New password" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField label="Confirm password" name="passwordAgain" required>
          <UInput v-model="state.passwordAgain" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" label="Change password" />
      </UForm>
    </template>
    <p class="text-sm text-center">
      <ULink to="/login" class="text-primary">
        Back to sign in
      </ULink>
    </p>
  </div>
</template>
