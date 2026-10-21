<script setup lang="ts">
import type { Form, TabsItem } from '@nuxt/ui'

definePageMeta({ minLevel: 3 })

const toast = useToast()
const { data, refresh, status } = await useFetch('/api/settings')

type Settings = NonNullable<typeof data.value>['settings']
type ShieldKey = 'defc' | 'defcpp' | 'shieldPy2' | 'shieldPy3'

const state = reactive({} as Settings & { shields: Record<ShieldKey, string | null> })
function fill() {
  if (!data.value)
    return
  Object.assign(state, structuredClone(toRaw(data.value.settings)), { shields: { ...data.value.shields } })
}
fill()

// Which tab each field lives in, so a server error can open the right tab.
const FIELD_TAB: Record<string, string> = {
  timezone: 'general', testerPath: 'general', assignmentsRoot: 'general',
  fileSizeLimit: 'judging', outputSizeLimit: 'judging', defaultLateRule: 'judging',
  registrationCode: 'accounts', mailFrom: 'accounts', mailFromName: 'accounts',
  resultsPerPageAll: 'display', resultsPerPageFinal: 'display', weekStart: 'display',
}

const tabs: TabsItem[] = [
  { label: 'General', icon: 'i-lucide-sliders-horizontal', value: 'general', slot: 'general' as const },
  { label: 'Judging', icon: 'i-lucide-gavel', value: 'judging', slot: 'judging' as const },
  { label: 'Shields', icon: 'i-lucide-shield', value: 'shields', slot: 'shields' as const },
  { label: 'Accounts & Mail', icon: 'i-lucide-mail', value: 'accounts', slot: 'accounts' as const },
  { label: 'Display', icon: 'i-lucide-monitor', value: 'display', slot: 'display' as const },
]
const tab = ref('general')

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => ({ label, value }))
const timezones = computed(() => {
  const list = data.value?.timezones ?? []
  return state.timezone && !list.includes(state.timezone) ? [state.timezone, ...list] : list
})

const SHIELDS: { key: ShieldKey, toggle: 'enableCShield' | 'enableCppShield' | 'enablePy2Shield' | 'enablePy3Shield', label: string, file: string }[] = [
  { key: 'defc', toggle: 'enableCShield', label: 'C', file: 'defc.h' },
  { key: 'defcpp', toggle: 'enableCppShield', label: 'C++', file: 'defcpp.h' },
  { key: 'shieldPy2', toggle: 'enablePy2Shield', label: 'Python 2', file: 'shield_py2.py' },
  { key: 'shieldPy3', toggle: 'enablePy3Shield', label: 'Python 3', file: 'shield_py3.py' },
]
const shieldTab = ref<ShieldKey>('defc')

const form = useTemplateRef<Form<typeof state>>('form')
const saving = ref(false)
const fileErrors = ref<string[]>([])
const warnings = ref<string[]>([])

const dirty = computed(() => {
  if (!data.value)
    return false
  const { shields, ...rest } = state
  return JSON.stringify(rest) !== JSON.stringify(data.value.settings) || JSON.stringify(shields) !== JSON.stringify(data.value.shields)
})

async function save() {
  if (!data.value)
    return
  saving.value = true
  fileErrors.value = []
  warnings.value = []
  try {
    // Send only shield files that were edited, so untouched files are never rewritten.
    const shields = Object.fromEntries(Object.entries(state.shields)
      .filter(([k, v]) => v !== null && v !== data.value!.shields[k as ShieldKey]))
    const res = await $fetch('/api/settings', { method: 'POST', body: { ...state, shields } })
    fileErrors.value = res.errors
    warnings.value = res.warnings
    if (res.timezone !== state.timezone)
      warnings.value.push(`"${state.timezone}" is not a valid timezone; it was set to ${res.timezone}.`)
    await refresh()
    fill()
    if (res.errors.length)
      toast.add({ title: 'Settings saved, but some shield files could not be written.', color: 'warning', icon: 'i-lucide-triangle-alert' })
    else
      toast.add({ title: 'Settings updated successfully.', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    const { message, fields } = apiError(e)
    const entries = Object.entries(fields).filter(([name]) => name !== '_')
    if (entries.length) {
      form.value?.setErrors(entries.map(([name, message]) => ({ name, message })))
      tab.value = FIELD_TAB[entries[0]![0]] ?? tab.value
    }
    toast.add({ title: entries.length ? 'Error updating settings.' : message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    saving.value = false
  }
}

function reset() {
  fill()
  form.value?.clear()
}
</script>

<template>
  <AppPage title="Settings" icon="i-lucide-settings">
    <div v-if="data" class="space-y-4">
      <UAlert
        v-for="msg in fileErrors"
        :key="msg"
        color="error"
        variant="subtle"
        icon="i-lucide-file-warning"
        :title="msg"
      />
      <UAlert
        v-for="msg in warnings"
        :key="msg"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="msg"
      />
      <UAlert
        v-if="!data.testerPathOk"
        color="error"
        variant="subtle"
        icon="i-lucide-folder-x"
        title='"Tester path" is not correct.'
        description="The shield files could not be read from the tester folder."
      />

      <UForm ref="form" :state="state" @submit="save">
        <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false" variant="link" class="w-full" :ui="{ list: 'overflow-x-auto', content: 'pt-4' }">
          <!-- General -->
          <template #general>
            <UCard>
              <div class="space-y-5">
                <UFormField label="Timezone" name="timezone" required :help="`Judge time now: ${formatDateTime(data.serverTime)}`">
                  <USelectMenu
                    v-model="state.timezone"
                    :items="timezones"
                    icon="i-lucide-globe"
                    :search-input="{ placeholder: 'Search timezones…' }"
                    virtualize
                    class="w-full sm:w-80"
                  />
                </UFormField>
                <UFormField label="Full path to tester" name="testerPath" help="Folder containing tester.sh, the shields and EasySandbox.">
                  <UInput v-model="state.testerPath" icon="i-lucide-folder-cog" class="w-full font-mono" />
                </UFormField>
                <UFormField label="Full path to assignments" name="assignmentsRoot" help="Submitted code is stored here; it must not be publicly accessible.">
                  <UInput v-model="state.assignmentsRoot" icon="i-lucide-folder-lock" class="w-full font-mono" />
                </UFormField>
              </div>
            </UCard>
          </template>

          <!-- Judging -->
          <template #judging>
            <div class="space-y-4">
              <UCard>
                <div class="grid gap-5 sm:grid-cols-2">
                  <UFormField label="Upload size limit" name="fileSizeLimit">
                    <UInput v-model="state.fileSizeLimit" inputmode="numeric" class="w-full">
                      <template #trailing>
                        <span class="text-xs text-muted">KB</span>
                      </template>
                    </UInput>
                  </UFormField>
                  <UFormField label="Output size limit" name="outputSizeLimit" help="Limit for the size of the output generated by submitted code.">
                    <UInput v-model="state.outputSizeLimit" inputmode="numeric" class="w-full">
                      <template #trailing>
                        <span class="text-xs text-muted">KB</span>
                      </template>
                    </UInput>
                  </UFormField>
                </div>
              </UCard>
              <UCard>
                <div class="space-y-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <USwitch v-model="state.enableEasysandbox" label="EasySandbox" description="Sandbox C/C++ submissions. EasySandbox must be built first." />
                    <UBadge :color="data.sandboxBuilt ? 'success' : 'error'" variant="subtle" :icon="data.sandboxBuilt ? 'i-lucide-check' : 'i-lucide-x'">
                      {{ data.sandboxBuilt ? 'EasySandbox is built' : 'You have not built EasySandbox yet' }}
                    </UBadge>
                  </div>
                  <USwitch v-model="state.enableJavaPolicy" label="Java policy" description="Run Java submissions with the security policy (Java sandboxing)." />
                  <USwitch v-model="state.enableLog" label="Log" description="Keep the tester log of each submission." />
                </div>
              </UCard>
              <UCard>
                <UFormField
                  label="Default coefficient rule"
                  name="defaultLateRule"
                  description="Used for new assignments. PHP-style script without <?php ?> tags; sets $coefficient from $delay and $extra_time (seconds)."
                >
                  <SettingsCodeArea v-model="state.defaultLateRule" :rows="12" />
                </UFormField>
              </UCard>
            </div>
          </template>

          <!-- Shields -->
          <template #shields>
            <div class="space-y-4">
              <UCard>
                <div class="grid gap-4 sm:grid-cols-2">
                  <USwitch v-for="s in SHIELDS" :key="s.key" v-model="state[s.toggle]" :label="`${s.label} shield`" :description="`Enable Shield for ${s.label}.`" />
                </div>
              </UCard>
              <UCard>
                <div class="flex flex-wrap gap-1 mb-3">
                  <UButton
                    v-for="s in SHIELDS"
                    :key="s.key"
                    size="sm"
                    :color="shieldTab === s.key ? 'primary' : 'neutral'"
                    :variant="shieldTab === s.key ? 'soft' : 'ghost'"
                    :label="s.file"
                    class="font-mono"
                    @click="shieldTab = s.key"
                  />
                </div>
                <template v-for="s in SHIELDS" :key="s.key">
                  <div v-show="shieldTab === s.key">
                    <UAlert
                      v-if="state.shields[s.key] === null"
                      color="neutral"
                      variant="subtle"
                      icon="i-lucide-file-question"
                      :title="`${s.file} could not be read from the tester folder.`"
                    />
                    <UFormField
                      v-else
                      :label="`Shield rules for ${s.label}`"
                      :description="`${data.settings.testerPath.replace(/\/+$/, '')}/shield/${s.file}`"
                    >
                      <SettingsCodeArea :model-value="state.shields[s.key] ?? ''" :rows="16" @update:model-value="v => (state.shields[s.key] = v)" />
                    </UFormField>
                  </div>
                </template>
              </UCard>
            </div>
          </template>

          <!-- Accounts & Mail -->
          <template #accounts>
            <div class="space-y-4">
              <UCard>
                <div class="space-y-5">
                  <USwitch v-model="state.enableRegistration" label="Public registration" description="Allow anyone to register a student account." />
                  <UFormField
                    label="Registration code"
                    name="registrationCode"
                    help="When registration is open, give this code to your students to validate registration. Enter 0 to disable."
                  >
                    <UInput v-model="state.registrationCode" icon="i-lucide-key-round" class="w-full sm:w-80" />
                  </UFormField>
                  <USwitch v-model="state.lockStudentDisplayName" label="Lock display names" description="Users other than admins cannot change their display name." />
                </div>
              </UCard>
              <UCard>
                <div class="space-y-5">
                  <div class="grid gap-5 sm:grid-cols-2">
                    <UFormField label="Send emails from" name="mailFrom">
                      <UInput v-model="state.mailFrom" type="email" icon="i-lucide-at-sign" class="w-full" />
                    </UFormField>
                    <UFormField label="Sender name" name="mailFromName">
                      <UInput v-model="state.mailFromName" class="w-full" />
                    </UFormField>
                  </div>
                  <UFormField label="Password reset email" name="resetPasswordMail" description="HTML. Placeholders: {SITE_URL}, {RESET_LINK}, {VALID_TIME}">
                    <SettingsCodeArea v-model="state.resetPasswordMail" :rows="8" />
                  </UFormField>
                  <UFormField label="Add user email" name="addUserMail" description="HTML. Placeholders: {SITE_URL}, {LOGIN_URL}, {ROLE}, {USERNAME}, {PASSWORD}">
                    <SettingsCodeArea v-model="state.addUserMail" :rows="8" />
                  </UFormField>
                </div>
              </UCard>
            </div>
          </template>

          <!-- Display -->
          <template #display>
            <UCard>
              <div class="grid gap-5 sm:grid-cols-2">
                <UFormField label="Week start day" name="weekStart" help="First day of the week in calendars.">
                  <USelect v-model="state.weekStart" :items="WEEK_DAYS" class="w-full" />
                </UFormField>
                <div class="hidden sm:block" />
                <UFormField label="Results per page — All submissions" name="resultsPerPageAll" help="Enter 0 for no limit.">
                  <UInput v-model="state.resultsPerPageAll" inputmode="numeric" class="w-full" />
                </UFormField>
                <UFormField label="Results per page — Final submissions" name="resultsPerPageFinal" help="Enter 0 for no limit.">
                  <UInput v-model="state.resultsPerPageFinal" inputmode="numeric" class="w-full" />
                </UFormField>
              </div>
            </UCard>
          </template>
        </UTabs>

        <div class="sticky bottom-0 z-10 mt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-default/90 backdrop-blur border-t border-default flex items-center gap-3">
          <UButton type="submit" :loading="saving" icon="i-lucide-save" label="Save changes" />
          <UButton color="neutral" variant="ghost" label="Discard" :disabled="!dirty || saving" @click="reset" />
          <span v-if="dirty" class="text-sm text-muted">Unsaved changes</span>
        </div>
      </UForm>
    </div>
    <div v-else-if="status === 'pending'" class="space-y-3">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </AppPage>
</template>
