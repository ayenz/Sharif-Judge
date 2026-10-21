<script setup lang="ts">
definePageMeta({ minLevel: 3 })

const { data: logs, status, refresh } = await useFetch('/api/logs', { default: () => [] })

const search = ref('')
const onlyFlagged = ref(false)
const focused = ref<number | null>(null)

/** Login ids referenced as "previous login from another IP". */
const referenced = computed(() => new Set(logs.value.map(l => l.last24hLoginId).filter((id): id is number => id !== null)))
const flaggedUsers = computed(() => new Set(logs.value.filter(l => l.last24hLoginId !== null).map(l => l.username)))

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return logs.value.filter(l =>
    (!q || l.username.toLowerCase().includes(q) || l.ipAddress.includes(q))
    && (!onlyFlagged.value || l.last24hLoginId !== null || referenced.value.has(l.loginId)))
})

function jump(id: number) {
  focused.value = id
  document.getElementById(`login-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function rowClass(l: { loginId: number, last24hLoginId: number | null }) {
  if (focused.value === l.loginId)
    return 'bg-primary/15'
  if (l.last24hLoginId !== null)
    return 'bg-warning/10'
  if (referenced.value.has(l.loginId))
    return 'bg-warning/5'
  return ''
}
</script>

<template>
  <AppPage title="24-hour Log" icon="i-lucide-history">
    <div class="space-y-4">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        description="Use this table to detect account lending in a pre-seated exam: each student should log in from only one IP address. When a user logs in from a different IP address within 24 hours, the row is highlighted and links to the previous login, so a proctor can check whether the account was used on two devices."
      />

      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <UCard :ui="{ body: 'p-3 sm:p-4' }">
          <p class="text-xs text-muted">
            Logins (24h)
          </p>
          <p class="text-2xl font-semibold tabular-nums">
            {{ logs.length }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-3 sm:p-4' }">
          <p class="text-xs text-muted">
            Users seen
          </p>
          <p class="text-2xl font-semibold tabular-nums">
            {{ new Set(logs.map(l => l.username)).size }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-3 sm:p-4' }" :class="flaggedUsers.size ? 'ring-warning/50' : ''">
          <p class="text-xs text-muted">
            Users with multiple IPs
          </p>
          <p class="text-2xl font-semibold tabular-nums" :class="flaggedUsers.size ? 'text-warning' : ''">
            {{ flaggedUsers.size }}
          </p>
        </UCard>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Username or IP…" class="w-full sm:w-64" />
        <USwitch v-model="onlyFlagged" label="Only logins from different IPs" />
        <UButton class="ms-auto" icon="i-lucide-refresh-cw" color="neutral" variant="ghost" label="Refresh" :loading="status === 'pending'" @click="refresh()" />
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-muted border-b border-default">
              <tr>
                <th class="px-4 py-3 font-medium">
                  #
                </th>
                <th class="px-4 py-3 font-medium">
                  Login ID
                </th>
                <th class="px-4 py-3 font-medium">
                  Username
                </th>
                <th class="px-4 py-3 font-medium">
                  IP address
                </th>
                <th class="px-4 py-3 font-medium">
                  Login time
                </th>
                <th class="px-4 py-3 font-medium">
                  Login from different IP (&lt; 24h)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(l, i) in rows"
                :id="`login-${l.loginId}`"
                :key="l.loginId"
                class="border-b border-default last:border-0 transition-colors scroll-mt-24"
                :class="rowClass(l)"
              >
                <td class="px-4 py-2.5 text-muted tabular-nums">
                  {{ i + 1 }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ l.loginId }}
                </td>
                <td class="px-4 py-2.5 font-medium">
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon v-if="flaggedUsers.has(l.username)" name="i-lucide-triangle-alert" class="text-warning" />
                    {{ l.username }}
                  </span>
                </td>
                <td class="px-4 py-2.5 font-mono text-xs">
                  {{ l.ipAddress }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap text-muted">
                  {{ formatDateTime(l.timestamp) }}
                </td>
                <td class="px-4 py-2.5">
                  <UButton
                    v-if="l.last24hLoginId !== null"
                    size="xs"
                    color="warning"
                    variant="soft"
                    icon="i-lucide-corner-left-down"
                    :label="`#${l.last24hLoginId}`"
                    @click="jump(l.last24hLoginId)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UEmpty
          v-if="!rows.length"
          icon="i-lucide-history"
          :title="logs.length ? 'No logins match.' : 'No logins in the last 24 hours.'"
          variant="naked"
          class="py-12"
        />
      </UCard>
    </div>
  </AppPage>
</template>
