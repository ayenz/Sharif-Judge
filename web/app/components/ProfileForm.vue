<script setup lang="ts">
import { ROLES, ROLE_LABEL } from '#shared/roles'

const props = defineProps<{ userId: number }>()

const { me, refresh: refreshMe } = useMe()
const { data: profile, error: loadError, refresh } = await useFetch(() => `/api/profile/${props.userId}`)
if (loadError.value)
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

interface ProfileState {
  displayName: string
  email: string
  password: string
  passwordAgain: string
  role?: string
}

const state = reactive<ProfileState>({ displayName: '', email: '', password: '', passwordAgain: '' })
function fill() {
  if (!profile.value)
    return
  state.displayName = profile.value.displayName
  state.email = profile.value.email
  state.password = ''
  state.passwordAgain = ''
  // Only admins may send a role; the server rejects it from anyone else.
  if (profile.value.canChangeRole)
    state.role = profile.value.role
  else
    delete state.role
}
fill()

const saved = ref(false)
const isSelf = computed(() => profile.value?.username === me.value?.username)
const roleItems: { label: string, value: string }[] = ROLES.map(r => ({ label: ROLE_LABEL[r], value: r }))

const { submit, loading, error } = useApiForm(() => `/api/profile/${props.userId}`, state, {
  successToast: 'Profile updated successfully.',
  onSuccess: async () => {
    saved.value = true
    await refresh()
    fill()
    if (isSelf.value)
      await refreshMe()
  },
})
</script>

<template>
  <div v-if="profile" class="max-w-2xl space-y-4">
    <UCard>
      <div class="flex items-center gap-4">
        <UAvatar :alt="profile.displayName || profile.username" size="xl" />
        <div class="min-w-0">
          <p class="font-semibold text-lg truncate" dir="auto">
            {{ profile.displayName || profile.username }}
          </p>
          <p class="text-sm text-muted truncate">
            @{{ profile.username }} · {{ profile.email }}
          </p>
        </div>
        <UBadge class="ms-auto" variant="subtle" :color="profile.role === 'admin' ? 'error' : profile.role === 'student' ? 'neutral' : 'primary'">
          {{ ROLE_LABEL[profile.role as keyof typeof ROLE_LABEL] ?? profile.role }}
        </UBadge>
      </div>
    </UCard>

    <UCard>
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" class="mb-4" />
      <UForm ref="form" :state="state" class="space-y-4" @submit="submit" @input="saved = false">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Username" help="You cannot change username.">
            <UInput :model-value="profile.username" disabled class="w-full" />
          </UFormField>
          <UFormField
            label="Display name"
            name="displayName"
            :help="profile.displayNameLocked ? 'Display names are locked by the administrator.' : undefined"
          >
            <UInput
              v-model="state.displayName"
              :disabled="profile.displayNameLocked"
              :trailing-icon="profile.displayNameLocked ? 'i-lucide-lock' : undefined"
              maxlength="40"
              autocomplete="name"
              dir="auto"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>

        <USeparator label="Change password" />

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="New password" name="password" help="Leave blank to keep the current password.">
            <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
          <UFormField label="Confirm password" name="passwordAgain">
            <UInput v-model="state.passwordAgain" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="profile.canChangeRole" label="User role" name="role">
          <USelect v-model="state.role" :items="roleItems" class="w-full sm:w-64" />
        </UFormField>

        <div class="flex items-center gap-3 pt-2">
          <UButton type="submit" :loading="loading" icon="i-lucide-save" label="Save" />
          <span v-if="saved" class="text-sm text-success flex items-center gap-1">
            <UIcon name="i-lucide-check" /> Saved
          </span>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
