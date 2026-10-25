<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in' })

const route = useRoute()
const { refresh } = useMe()
const { data: options } = await useFetch('/api/auth/options')
if (options.value && !options.value.installed)
  await navigateTo('/install')

const state = reactive({ username: '', password: '', turnstileToken: '' })
const { submit, loading, error } = useApiForm('/api/auth/login', state, {
  onSuccess: async () => {
    await refresh()
    await navigateTo(typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/')
  },
})
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
        Sign in
      </h1>
      <p class="text-sm text-muted">
        Use your judge account to continue.
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
      <UFormField label="Username" name="username" required>
        <UInput v-model="state.username" required autocomplete="username" autofocus class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" required type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UFormField v-if="options?.turnstileSiteKey" name="turnstile">
        <ClientOnly>
          <TurnstileWidget ref="turnstile" v-model="state.turnstileToken" :site-key="options.turnstileSiteKey" />
        </ClientOnly>
      </UFormField>
      <UButton type="submit" block :loading="loading" :disabled="!!options?.turnstileSiteKey && !state.turnstileToken" label="Sign in" />
      <!-- After the button, so Tab goes username → password → Sign in. -->
      <p class="text-center">
        <ULink to="/lost" class="text-xs">
          Forgot password?
        </ULink>
      </p>
    </UForm>

    <p v-if="options?.registration" class="text-sm text-center text-muted">
      No account yet? <ULink to="/register" class="text-primary">
        Register
      </ULink>
    </p>
  </div>
</template>
