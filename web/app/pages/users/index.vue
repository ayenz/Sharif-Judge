<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'
import { ROLE_LABEL, type Role } from '#shared/roles'

definePageMeta({ minLevel: 3 })

interface UserRow {
  id: number
  username: string
  displayName: string
  email: string
  role: string
  firstLoginTime: string | null
  lastLoginTime: string | null
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const NuxtLink = resolveComponent('NuxtLink')

const toast = useToast()
const { me } = useMe()
const { data: users, status, refresh } = await useFetch<UserRow[]>('/api/users', { default: () => [] })

const search = ref('')
const sorting = ref([{ id: 'role', desc: false }])

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'info' | 'neutral'> = {
  admin: 'error',
  head_instructor: 'warning',
  instructor: 'info',
  student: 'neutral',
}
const ROLE_ORDER: Record<string, number> = { admin: 0, head_instructor: 1, instructor: 2, student: 3 }

function sortHeader(label: string) {
  return ({ column }: { column: Column<UserRow> }) => {
    const sorted = column.getIsSorted()
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      size: 'xs',
      trailingIcon: sorted ? (sorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
      // Same text style as every other column header (see .data-table in main.css).
      class: '-mx-2 text-xs font-medium uppercase tracking-wide text-muted',
      onClick: () => column.toggleSorting(sorted === 'asc'),
    })
  }
}

const columns: TableColumn<UserRow>[] = [
  { accessorKey: 'id', header: sortHeader('ID'), cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, row.original.id) },
  {
    accessorKey: 'username',
    header: sortHeader('Username'),
    cell: ({ row }) => h(NuxtLink, { to: `/profile/${row.original.id}`, class: 'font-medium hover:text-primary' }, () => row.original.username),
  },
  { accessorKey: 'displayName', header: sortHeader('Display name'), cell: ({ row }) => h('span', { dir: 'auto' }, row.original.displayName) },
  { accessorKey: 'email', header: sortHeader('Email'), cell: ({ row }) => h('span', { class: 'text-muted' }, row.original.email) },
  {
    accessorKey: 'role',
    header: sortHeader('Role'),
    sortingFn: (a, b) => (ROLE_ORDER[a.original.role] ?? 9) - (ROLE_ORDER[b.original.role] ?? 9) || a.original.id - b.original.id,
    cell: ({ row }) => h(UBadge, { color: ROLE_COLOR[row.original.role] ?? 'neutral', variant: 'subtle' }, () => ROLE_LABEL[row.original.role as Role] ?? row.original.role),
  },
  {
    accessorKey: 'firstLoginTime',
    header: sortHeader('First login'),
    cell: ({ row }) => h('span', { class: 'text-muted whitespace-nowrap' }, row.original.firstLoginTime ? formatDateTime(row.original.firstLoginTime) : 'Never'),
  },
  {
    accessorKey: 'lastLoginTime',
    header: sortHeader('Last login'),
    cell: ({ row }) => h('span', { class: 'text-muted whitespace-nowrap' }, row.original.lastLoginTime ? formatDateTime(row.original.lastLoginTime) : 'Never'),
  },
  {
    id: 'actions',
    header: 'Actions',
    meta: { class: { th: 'text-right', td: 'text-right' } },
    cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
      items: rowActions(row.original),
      content: { align: 'end' },
    }, () => h(UButton, { 'icon': 'i-lucide-ellipsis-vertical', 'color': 'neutral', 'variant': 'ghost', 'aria-label': `Actions for ${row.original.username}` }))),
  },
]

function rowActions(user: UserRow): DropdownMenuItem[][] {
  return [
    [
      { label: 'Edit profile', icon: 'i-lucide-pencil', to: `/profile/${user.id}` },
      { label: 'Submissions', icon: 'i-lucide-list', to: { path: '/submissions/all', query: { user: user.username } } },
    ],
    [
      { label: 'Delete submissions', icon: 'i-lucide-file-x', color: 'warning', onSelect: () => ask('submissions', user) },
      { label: 'Delete user', icon: 'i-lucide-trash-2', color: 'error', disabled: user.id === me.value?.id, onSelect: () => ask('user', user) },
    ],
  ]
}

const confirm = reactive({ open: false, kind: 'user' as 'user' | 'submissions', user: null as UserRow | null, loading: false })

function ask(kind: 'user' | 'submissions', user: UserRow) {
  Object.assign(confirm, { open: true, kind, user, loading: false })
}

async function runConfirmed() {
  const user = confirm.user
  if (!user)
    return
  confirm.loading = true
  try {
    if (confirm.kind === 'user') {
      await $fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      toast.add({ title: `User ${user.username} deleted.`, color: 'success', icon: 'i-lucide-check' })
    }
    else {
      await $fetch(`/api/users/${user.id}/submissions`, { method: 'DELETE' })
      toast.add({ title: `Submissions of ${user.username} deleted.`, color: 'success', icon: 'i-lucide-check' })
    }
    confirm.open = false
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    confirm.loading = false
  }
}

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const u of users.value)
    c[u.role] = (c[u.role] ?? 0) + 1
  return c
})
</script>

<template>
  <AppPage title="Users" icon="i-lucide-users">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search users…" class="w-full sm:w-72" />
        <div class="hidden md:flex items-center gap-1.5 text-sm text-muted">
          <span>{{ users.length }} users</span>
          <template v-for="(label, role) in ROLE_LABEL" :key="role">
            <span v-if="counts[role]">· {{ counts[role] }} {{ label.toLowerCase() }}</span>
          </template>
        </div>
        <div class="flex gap-2 ms-auto">
          <UButton to="/api/users/excel" external download icon="i-lucide-file-spreadsheet" color="neutral" variant="outline" label="Excel" />
          <UButton to="/users/add" icon="i-lucide-user-plus" label="Add users" />
        </div>
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          v-model:global-filter="search"
          v-model:sorting="sorting"
          :data="users"
          :columns="columns"
          :loading="status === 'pending'"
          sticky
          class="max-h-[calc(100vh-14rem)]"
        >
          <template #empty>
            <div class="py-10 text-center text-muted">
              <UIcon name="i-lucide-users" class="size-8 mb-2" />
              <p>{{ search ? 'No users match your search.' : 'No users yet.' }}</p>
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <UModal
      v-model:open="confirm.open"
      :title="confirm.kind === 'user' ? 'Delete user' : 'Delete submissions'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <p v-if="confirm.kind === 'user'" class="text-sm">
          Delete user <strong>{{ confirm.user?.username }}</strong>? All of their submissions and submitted files will be
          deleted too. This cannot be undone.
        </p>
        <p v-else class="text-sm">
          Delete all submissions of <strong>{{ confirm.user?.username }}</strong>, including their submitted files?
          This cannot be undone.
        </p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="ghost" label="Cancel" @click="confirm.open = false" />
        <UButton
          color="error"
          :loading="confirm.loading"
          :label="confirm.kind === 'user' ? 'Delete user' : 'Delete submissions'"
          icon="i-lucide-trash-2"
          @click="runConfirmed"
        />
      </template>
    </UModal>
  </AppPage>
</template>
