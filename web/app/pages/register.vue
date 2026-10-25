<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Register' })

const { data: options } = await useFetch('/api/auth/options')
if (!options.value?.registration)
  throw createError({ statusCode: 403, statusMessage: 'Registration is closed.' })

const done = ref(false)
const state = reactive({ registrationCode: '', username: '', email: '', displayName: '', password: '', passwordAgain: '', turnstileToken: '' })
const { submit, loading, error } = useApiForm('/api/auth/register', state, { onSuccess: () => (done.value = true) })
// The security check token is single-use: get a new one after every attempt.
const turnstile = useTemplateRef<{ reset: () => void }>('turnstile')
watch(loading, (now, before) => {
  if (before && !now)
    turnstile.value?.reset()
})
</script>

<template>
  <div v-if="done" class="space-y-4 text-center">
    <UIcon name="i-lucide-circle-check" class="size-10 text-success" />
    <h1 class="text-lg font-semibold">
      Registration complete
    </h1>
    <p class="text-sm text-muted">
      You can now sign in with your new account.
    </p>
    <UButton to="/login" block label="Go to sign in" />
  </div>

  <div v-else class="space-y-5">
    <h1 class="text-lg font-semibold">
      Create an account
    </h1>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
    <UForm ref="form" :state="state" class="space-y-4" @submit="submit">
      <UFormField v-if="options?.registrationCodeRequired" label="Registration code" name="registrationCode" required>
        <UInput v-model="state.registrationCode" required class="w-full" />
      </UFormField>
      <UFormField label="Username" name="username" required help="3–20 lowercase letters or digits">
        <UInput v-model="state.username" required autocomplete="username" class="w-full" />
      </UFormField>
      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" required type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Display name" name="displayName">
        <UInput v-model="state.displayName" autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" required type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField label="Confirm password" name="passwordAgain" required>
        <UInput v-model="state.passwordAgain" required type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField v-if="options?.turnstileSiteKey" name="turnstile">
        <ClientOnly>
          <TurnstileWidget ref="turnstile" v-model="state.turnstileToken" :site-key="options.turnstileSiteKey" />
        </ClientOnly>
      </UFormField>
      <UButton type="submit" block :loading="loading" :disabled="!!options?.turnstileSiteKey && !state.turnstileToken" label="Register" />
    </UForm>
    <p class="text-sm text-center text-muted">
      Already registered? <ULink to="/login" class="text-primary">
        Sign in
      </ULink>
    </p>
  </div>
</template>
