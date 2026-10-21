import { AdminRow, buildQuery } from '@/lib/admin'
import type { AuthUser } from '@/lib/auth'

// Declarative config for the admin CRUD pages: one entry per resource, rendered
// by <AdminResourcePage>. Endpoints and fields follow the BE contract
// (Phase 2, section (c)).

// Where a <select> gets its options. `endpoint` receives the current form
// values so dependent selects can scope themselves (return null until ready).
export interface OptionsSource {
  endpoint: (values: Record<string, string>) => string | null
  resultKey: string
  valueKey: string
  labelKey: string
}

export interface AdminField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select'
  required?: boolean
  /** Only required (and only sent) when creating; optional on edit when blank. */
  requiredOnCreateOnly?: boolean
  help?: string
  min?: number
  options?: OptionsSource
  /** Changing this parent field clears this one (e.g. department → designation). */
  dependsOn?: string
}

export interface AdminFilter {
  param: string
  label: string
  allLabel: string
  options: OptionsSource
}

export interface RowContext {
  /** department id → name, loaded when `needsDepartments` is set. */
  departments: Record<number, string>
}

export interface AdminColumn {
  header: string
  value: (row: AdminRow, ctx: RowContext) => string
}

export interface RowLock {
  /** Reason the row can't be edited; disables the Edit button. */
  edit?: string
  /** Reason the row can't be deactivated; disables the Deactivate button. */
  deactivate?: string
}

// Server pages hand a client component only this string key: the config below
// holds functions, which can't cross the server → client boundary.
export const ADMIN_RESOURCE_KEYS = [
  'users',
  'roles',
  'departments',
  'designations',
  'priorities',
  'concern-types',
  'nature-of-work',
] as const
export type AdminResourceKey = (typeof ADMIN_RESOURCE_KEYS)[number]

export interface AdminResource {
  slug: AdminResourceKey
  title: string
  singular: string
  description: string
  endpoint: string
  /** POST target when it differs from `endpoint` (designations). */
  createEndpoint?: string
  /** Key under `result` that holds the paginator. */
  listKey: string
  searchPlaceholder: string
  columns: AdminColumn[]
  fields: AdminField[]
  filters?: AdminFilter[]
  needsDepartments?: boolean
  rowTitle: (row: AdminRow) => string
  deactivateNote?: string
  lock?: (row: AdminRow, me: AuthUser | null) => RowLock | null
}

export const DEPARTMENT_HEAD_ROLE = 'Department Head'
export const OTHERS_NATURE_OF_WORK = 'Others'

const str = (v: unknown) => (v == null ? '' : String(v))

const departmentOptions: OptionsSource = {
  // Active departments only, available to any authenticated user.
  endpoint: () => '/lookups/departments',
  resultKey: 'departments',
  valueKey: 'id',
  labelKey: 'name',
}

const departmentFilter: AdminFilter = {
  param: 'department_id',
  label: 'Department',
  allLabel: 'All departments',
  options: departmentOptions,
}

const departmentField: AdminField = {
  name: 'department_id',
  label: 'Department',
  type: 'select',
  required: true,
  options: departmentOptions,
}

const nested = (row: AdminRow, key: string) => str((row[key] as { name?: unknown } | undefined)?.name)

export const ADMIN_RESOURCES: AdminResource[] = [
  {
    slug: 'users',
    title: 'Users',
    singular: 'user',
    description: 'Create accounts and manage who can sign in.',
    endpoint: '/admin/users',
    listKey: 'users',
    searchPlaceholder: 'Name or email',
    columns: [
      { header: 'Name', value: r => `${str(r.first_name)} ${str(r.last_name)}`.trim() },
      { header: 'Email', value: r => str(r.email) },
      { header: 'Department', value: r => nested(r, 'department') },
      { header: 'Designation', value: r => nested(r, 'designation') },
      { header: 'Role', value: r => nested(r, 'role') },
    ],
    fields: [
      { name: 'first_name', label: 'First name', type: 'text', required: true },
      { name: 'last_name', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        requiredOnCreateOnly: true,
        min: 8,
        help: 'At least 8 characters. Leave blank when editing to keep the current password.',
      },
      departmentField,
      {
        name: 'designation_id',
        label: 'Designation',
        type: 'select',
        required: true,
        dependsOn: 'department_id',
        options: {
          endpoint: v =>
            v.department_id
              ? `/admin/designations${buildQuery({ department_id: v.department_id, status: 'active', per_page: 100 })}`
              : null,
          resultKey: 'designations',
          valueKey: 'id',
          labelKey: 'designation',
        },
      },
      {
        name: 'role_id',
        label: 'Role',
        type: 'select',
        required: true,
        options: { endpoint: () => '/roles', resultKey: 'roles', valueKey: 'id', labelKey: 'name' },
      },
    ],
    rowTitle: r => `${str(r.first_name)} ${str(r.last_name)}`.trim(),
    deactivateNote:
      'They will be signed out everywhere (their sessions are revoked) and cannot log in until reactivated.',
    lock: (row, me) =>
      me && row.id === me.id ? { deactivate: "You can't deactivate your own account." } : null,
  },
  {
    slug: 'roles',
    title: 'Roles',
    singular: 'role',
    description: 'Roles decide what a user can do. Department Head is the admin role.',
    endpoint: '/admin/roles',
    listKey: 'roles',
    searchPlaceholder: 'Role name',
    columns: [{ header: 'Name', value: r => str(r.name) }],
    fields: [{ name: 'name', label: 'Name', type: 'text', required: true }],
    rowTitle: r => str(r.name),
    deactivateNote: 'Roles that active users still hold cannot be deactivated.',
    lock: row =>
      row.name === DEPARTMENT_HEAD_ROLE
        ? {
            edit: 'The Department Head role is built in and cannot be renamed.',
            deactivate: 'The Department Head role is built in and cannot be deactivated.',
          }
        : null,
  },
  {
    slug: 'departments',
    title: 'Departments',
    singular: 'department',
    description: 'Departments that handle tickets.',
    endpoint: '/admin/departments',
    listKey: 'departments',
    searchPlaceholder: 'Department name',
    columns: [{ header: 'Name', value: r => str(r.name) }],
    fields: [{ name: 'name', label: 'Name', type: 'text', required: true }],
    rowTitle: r => str(r.name),
    deactivateNote: 'Existing tickets keep their department; it just stops appearing in lookups.',
  },
  {
    slug: 'designations',
    title: 'Designations',
    singular: 'designation',
    description: 'Job titles, scoped per department.',
    endpoint: '/admin/designations',
    // Creating stays on the public-contract route.
    createEndpoint: '/designations',
    listKey: 'designations',
    searchPlaceholder: 'Designation',
    needsDepartments: true,
    filters: [departmentFilter],
    columns: [
      { header: 'Designation', value: r => str(r.designation) },
      { header: 'Department', value: (r, ctx) => ctx.departments[Number(r.department_id)] ?? '' },
    ],
    fields: [departmentField, { name: 'designation', label: 'Designation', type: 'text', required: true }],
    rowTitle: r => str(r.designation),
  },
  {
    slug: 'priorities',
    title: 'Priorities',
    singular: 'priority',
    description: 'Priority levels and their SLA per department.',
    endpoint: '/admin/priorities',
    listKey: 'priorities',
    searchPlaceholder: 'Priority level',
    needsDepartments: true,
    filters: [departmentFilter],
    columns: [
      { header: 'Level', value: r => str(r.level) },
      { header: 'SLA (days)', value: r => str(r.sla_days) },
      { header: 'Department', value: (r, ctx) => ctx.departments[Number(r.department_id)] ?? '' },
    ],
    fields: [
      departmentField,
      { name: 'level', label: 'Level', type: 'text', required: true },
      { name: 'sla_days', label: 'SLA (days)', type: 'number', required: true, min: 0 },
    ],
    rowTitle: r => str(r.level),
  },
  {
    slug: 'concern-types',
    title: 'Concern types',
    singular: 'concern type',
    description: 'Types of concern users can pick when raising an IT ticket.',
    endpoint: '/admin/concern-types',
    listKey: 'concern_types',
    searchPlaceholder: 'Label',
    columns: [{ header: 'Label', value: r => str(r.label) }],
    fields: [{ name: 'label', label: 'Label', type: 'text', required: true }],
    rowTitle: r => str(r.label),
  },
  {
    slug: 'nature-of-work',
    title: 'Nature of work',
    singular: 'nature of work',
    description: 'Kinds of work users can pick when raising an Engineering ticket.',
    endpoint: '/admin/nature-of-work',
    listKey: 'nature_of_work',
    searchPlaceholder: 'Label',
    columns: [{ header: 'Label', value: r => str(r.label) }],
    fields: [{ name: 'label', label: 'Label', type: 'text', required: true }],
    rowTitle: r => str(r.label),
    // The catch-all option tickets fall back to; the API answers 409 for it.
    lock: row =>
      row.label === OTHERS_NATURE_OF_WORK
        ? {
            edit: 'The "Others" option is built in and cannot be renamed.',
            deactivate: 'The "Others" option is built in and cannot be deactivated.',
          }
        : null,
  },
]

export function getAdminResource(slug: AdminResourceKey): AdminResource {
  const resource = ADMIN_RESOURCES.find(r => r.slug === slug)
  if (!resource) throw new Error(`Unknown admin resource: ${slug}`)
  return resource
}
