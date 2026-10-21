export const ROLES = ['admin', 'head_instructor', 'instructor', 'student'] as const
export type Role = typeof ROLES[number]

/** Permission level: admin 3, head instructor 2, instructor 1, student 0. */
export const ROLE_LEVEL: Record<Role, number> = {
  admin: 3,
  head_instructor: 2,
  instructor: 1,
  student: 0,
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  head_instructor: 'Head Instructor',
  instructor: 'Instructor',
  student: 'Student',
}

export const LEVEL = { student: 0, instructor: 1, headInstructor: 2, admin: 3 } as const
