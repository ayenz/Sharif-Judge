<script setup lang="ts">
definePageMeta({ minLevel: 3 })

type BulkUser = [string, string, string, string, string]
interface AddResult {
  ok: BulkUser[]
  errors: [...BulkUser, string][]
  mailed: number
  mailRequested: boolean
}

const TEMPLATE = `# Lines starting with a # sign are comments.
# Each line (except comments) represents a user.
# The syntax of each line is:
#
# USERNAME,EMAIL,DISPLAY-NAME,PASSWORD,ROLE
#
# Roles: admin head_instructor instructor student
# You can use RANDOM[n] for password to generate random n-digit password.
`

const toast = useToast()
const state = reactive({ newUsers: TEMPLATE, sendMail: false, delay: 2 })
const result = ref<AddResult | null>(null)

const { submit, loading, error } = useApiForm<typeof state, AddResult>('/api/users/add', state, {
  onSuccess: (res) => {
    result.value = res
    if (res.ok.length)
      toast.add({ title: `${res.ok.length} user(s) added.`, color: 'success', icon: 'i-lucide-check' })
    if (res.errors.length)
      toast.add({ title: `${res.errors.length} line(s) could not be added.`, color: 'warning', icon: 'i-lucide-triangle-alert' })
  },
})

const lineCount = computed(() => state.newUsers.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#')).length)

/** Tab inserts a tab character, Esc toggles that off (like the legacy taboverride). */
const tabIndent = ref(true)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    tabIndent.value = !tabIndent.value
    return
  }
  if (e.key !== 'Tab' || !tabIndent.value || e.shiftKey)
    return
  e.preventDefault()
  const el = e.target as HTMLTextAreaElement
  const { selectionStart: s, selectionEnd: end } = el
  state.newUsers = `${state.newUsers.slice(0, s)}\t${state.newUsers.slice(end)}`
  nextTick(() => el.setSelectionRange(s + 1, s + 1))
}

/**
 * Copies text exactly (no surrounding spaces or tabs, unlike selecting a table cell). The
 * Clipboard API only exists on HTTPS pages, and campus installations often run on plain HTTP,
 * so fall back to a hidden textarea there.
 */
async function copyText(text: string, title: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    }
    else {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      if (!ok)
        throw new Error('copy failed')
    }
    toast.add({ title, color: 'success', icon: 'i-lucide-clipboard-check' })
  }
  catch {
    toast.add({ title: 'Could not access the clipboard.', color: 'error' })
  }
}

function copyPasswords() {
  if (result.value)
    copyText(result.value.ok.map(u => u.join(',')).join('\n'), 'Copied to clipboard.')
}

function again() {
  result.value = null
  state.newUsers = TEMPLATE
}
</script>

<template>
  <AppPage title="Add users" icon="i-lucide-user-plus">
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UButton to="/users" icon="i-lucide-arrow-left" color="neutral" variant="ghost" label="Users" />
      </div>

      <!-- Result -->
      <template v-if="result">
        <UCard v-if="result.ok.length">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
              <h2 class="font-semibold">
                {{ result.ok.length }} user(s) added successfully
              </h2>
              <UBadge v-if="result.mailRequested" :color="result.mailed === result.ok.length ? 'success' : 'warning'" variant="subtle">
                {{ result.mailed }} / {{ result.ok.length }} mails sent
              </UBadge>
              <UButton class="ms-auto" size="sm" color="neutral" variant="outline" icon="i-lucide-copy" label="Copy as CSV" @click="copyPasswords" />
            </div>
          </template>
          <p class="text-sm text-muted mb-3">
            Passwords are shown only once. Copy them now if you need to hand them out.
          </p>
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="font-medium">
                    #
                  </th>
                  <th class="font-medium">
                    Username
                  </th>
                  <th class="font-medium">
                    Email
                  </th>
                  <th class="font-medium">
                    Display name
                  </th>
                  <th class="font-medium">
                    Password
                  </th>
                  <th class="font-medium">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(u, i) in result.ok" :key="u[0]">
                  <td class="text-muted">
                    {{ i + 1 }}
                  </td>
                  <td class="font-medium">
                    {{ u[0] }}
                  </td>
                  <td>
                    {{ u[1] }}
                  </td>
                  <td dir="auto">
                    {{ u[2] }}
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <code class="font-mono bg-elevated rounded px-1.5 py-0.5">{{ u[3] }}</code>
                      <UTooltip text="Copy password">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-copy"
                          :aria-label="`Copy the password of ${u[0]}`"
                          @click="copyText(u[3], `Password of ${u[0]} copied.`)"
                        />
                      </UTooltip>
                    </div>
                  </td>
                  <td>
                    {{ u[4] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard v-if="result.errors.length">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-circle-x" class="size-5 text-error" />
              <h2 class="font-semibold">
                Error adding {{ result.errors.length }} user(s)
              </h2>
            </div>
          </template>
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="font-medium">
                    Username
                  </th>
                  <th class="font-medium">
                    Email
                  </th>
                  <th class="font-medium">
                    Display name
                  </th>
                  <th class="font-medium">
                    Password
                  </th>
                  <th class="font-medium">
                    Role
                  </th>
                  <th class="font-medium">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(u, i) in result.errors" :key="i">
                  <td class="font-medium">
                    {{ u[0] }}
                  </td>
                  <td>
                    {{ u[1] }}
                  </td>
                  <td dir="auto">
                    {{ u[2] }}
                  </td>
                  <td>
                    <code v-if="u[3]" class="font-mono bg-elevated rounded px-1.5 py-0.5">{{ u[3] }}</code>
                  </td>
                  <td>
                    {{ u[4] }}
                  </td>
                  <td class="text-error">
                    {{ u[5] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard v-if="!result.ok.length && !result.errors.length">
          <p class="text-sm text-muted text-center py-4">
            No users found in the input (only comments or empty lines).
          </p>
        </UCard>

        <div class="flex gap-2">
          <UButton icon="i-lucide-user-plus" label="Add more users" @click="again" />
          <UButton to="/users" color="neutral" variant="outline" label="Back to users" />
        </div>
      </template>

      <!-- Form -->
      <UForm v-else ref="form" :state="state" class="grid gap-4 lg:grid-cols-[1fr_18rem]" @submit="submit">
        <UCard>
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" class="mb-4" />
          <UFormField name="newUsers" :help="`${lineCount} user line(s). Tab inserts a tab; press Esc to ${tabIndent ? 'disable' : 'enable'} that.`">
            <UTextarea
              v-model="state.newUsers"
              :rows="18"
              autoresize
              :maxrows="30"
              class="w-full"
              :ui="{ base: 'font-mono text-sm' }"
              spellcheck="false"
              aria-label="New users"
              @keydown="onKeydown"
            />
          </UFormField>
        </UCard>

        <div class="space-y-4">
          <UCard>
            <div class="space-y-4">
              <USwitch v-model="state.sendMail" label="Send usernames and passwords by email" />
              <UFormField v-if="state.sendMail" label="Delay between mails (seconds)" name="delay" help="Waits before sending each email, so please be patient.">
                <UInputNumber v-model="state.delay" :min="0" :max="60" class="w-full" />
              </UFormField>
              <UButton type="submit" block :loading="loading" icon="i-lucide-user-plus" :label="loading ? 'Adding users…' : 'Add users'" />
            </div>
          </UCard>
          <UCard :ui="{ body: 'text-sm text-muted space-y-2' }">
            <p class="font-medium text-default">
              Format
            </p>
            <p><code class="font-mono text-xs">username,email,display name,password,role</code></p>
            <ul class="list-disc ps-4 space-y-1">
              <li>Usernames: 3–20 lowercase letters or digits.</li>
              <li>Passwords: 6–200 characters, or <code class="font-mono text-xs">RANDOM[n]</code>.</li>
              <li>Roles: admin, head_instructor, instructor, student.</li>
              <li>When sending mails, do not add too many users at one time; mail delivery may fail.</li>
            </ul>
            <p>The mail text is set in <ULink to="/settings" class="text-primary">Settings</ULink> (Add user email).</p>
          </UCard>
        </div>
      </UForm>
    </div>
  </AppPage>
</template>
