<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Reset password' })

const sent = ref(false)
const state = reactive({ email: '' })
const { submit, loading, error } = useApiForm('/api/auth/lost', state, { onSuccess: () => (sent.value = true) })
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">
        Forgot your password?
      </h1>
      <p class="text-sm text-muted">
        We will email you a link to set a new one.
      </p>
    </div>
    <UAlert
      v-if="sent"
      color="success"
      variant="subtle"
      icon="i-lucide-mail-check"
      title="Check your inbox"
      description="If an account uses this email, a reset link valid for 1 hour has been sent."
    />
    <template v-else>
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
      <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" autofocus class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" label="Send reset link" />
      </UForm>
    </template>
    <p class="text-sm text-center">
      <ULink to="/login" class="text-primary">
        Back to sign in
      </ULink>
    </p>
  </div>
</template>
