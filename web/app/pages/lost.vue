<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Reset password' })

const { data: options } = await useFetch('/api/auth/options')
const sent = ref(false)
const state = reactive({ email: '', turnstileToken: '' })
const { submit, loading, error } = useApiForm('/api/auth/lost', state, { onSuccess: () => (sent.value = true) })
// The security check token is single-use: get a new one after every attempt.
const turnstile = useTemplateRef<{ reset: () => void }>('turnstile')
watch(loading, (now, before) => {
  if (before && !now)
    turnstile.value?.reset()
})
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
          <UInput v-model="state.email" required type="email" autocomplete="email" autofocus class="w-full" />
        </UFormField>
        <UFormField v-if="options?.turnstileSiteKey" name="turnstile">
          <ClientOnly>
            <TurnstileWidget ref="turnstile" v-model="state.turnstileToken" :site-key="options.turnstileSiteKey" />
          </ClientOnly>
        </UFormField>
        <UButton type="submit" block :loading="loading" :disabled="!!options?.turnstileSiteKey && !state.turnstileToken" label="Send reset link" />
      </UForm>
    </template>
    <p class="text-sm text-center">
      <ULink to="/login" class="text-primary">
        Back to sign in
      </ULink>
    </p>
  </div>
</template>
