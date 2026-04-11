import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../adapter';
import { schema } from '../db';

const {
  users,
  clients,
  roles,
  userRoleAssignments,
} = schema;

export const DEFAULT_GLOBAL_USER_ROLE_CODE = 'user';
export const JANUS_ADMIN_ROLE_CODE = 'janus_admin';
export const DEFAULT_CLIENT_ROLE_CODE = 'user';

export type RoleScopeType = 'GLOBAL' | 'CLIENT';

export interface RoleInput {
  name: string;
  code: string;
  scopeType: RoleScopeType;
  clientId?: string | null;
  description?: string | null;
  isSystem?: boolean;
}

export interface UserRoleSummary {
  id: string;
  sub: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
  roles: Array<{
    id: string;
    name: string;
    code: string;
    scopeType: RoleScopeType;
    clientId: string | null;
    scopeKey: string;
    isSystem: boolean;
  }>;
}

export interface RoleCatalogItem {
  id: string;
  name: string;
  code: string;
  scopeType: RoleScopeType;
  scopeKey: string;
  clientId: string | null;
  clientName: string | null;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
}

export function buildRoleScopeKey(scopeType: RoleScopeType, clientId?: string | null): string {
  if (scopeType === 'GLOBAL') {
    return 'GLOBAL';
  }

  if (!clientId) {
    throw new Error('clientId é obrigatório para papéis de cliente');
  }

  return `CLIENT:${clientId}`;
}

export async function getRoleByScopeAndCode(
  scopeType: RoleScopeType,
  code: string,
  clientId?: string | null
): Promise<undefined | typeof roles.$inferSelect> {
  const scopeKey = buildRoleScopeKey(scopeType, clientId);
  const result = await db.select().from(roles).where(
    and(
      eq(roles.scopeKey, scopeKey),
      eq(roles.code, code),
    )
  ).limit(1);

  return result[0];
}

export async function ensureRoleExists(input: RoleInput): Promise<typeof roles.$inferSelect> {
  const scopeKey = buildRoleScopeKey(input.scopeType, input.clientId ?? null);
  const existing = await db.select().from(roles).where(
    and(
      eq(roles.scopeKey, scopeKey),
      eq(roles.code, input.code),
    )
  ).limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db.insert(roles).values({
    name: input.name,
    code: input.code,
    scopeType: input.scopeType,
    scopeKey,
    clientId: input.clientId ?? null,
    description: input.description ?? null,
    isSystem: input.isSystem ?? false,
  }).returning();

  return created;
}

export async function updateRole(
  roleId: string,
  input: Partial<Pick<RoleInput, 'name' | 'description'>>
): Promise<undefined | typeof roles.$inferSelect> {
  const [updated] = await db.update(roles)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId))
    .returning();

  return updated;
}

export async function deleteRole(roleId: string): Promise<boolean> {
  const role = await getRoleById(roleId);

  if (!role || role.isSystem) {
    return false;
  }

  await db.delete(roles).where(eq(roles.id, roleId));
  return true;
}

export async function getRoleById(roleId: string): Promise<undefined | typeof roles.$inferSelect> {
  const result = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return result[0];
}

export async function listRoles(): Promise<RoleCatalogItem[]> {
  const rows = await db.select({
    id: roles.id,
    name: roles.name,
    code: roles.code,
    scopeType: roles.scopeType,
    scopeKey: roles.scopeKey,
    clientId: roles.clientId,
    description: roles.description,
    isSystem: roles.isSystem,
    createdAt: roles.createdAt,
    clientName: clients.name,
  }).from(roles)
    .leftJoin(clients, eq(roles.clientId, clients.clientId))
    .orderBy(desc(roles.createdAt));

  return rows.map((row) => ({
    ...row,
    scopeType: row.scopeType as RoleScopeType,
  }));
}

export async function ensureUserRole(userId: string, roleId: string, assignedByUserId?: string | null): Promise<boolean> {
  const existing = await db.select({ id: userRoleAssignments.id }).from(userRoleAssignments).where(
    and(
      eq(userRoleAssignments.userId, userId),
      eq(userRoleAssignments.roleId, roleId),
    )
  ).limit(1);

  if (existing[0]) {
    return false;
  }

  await db.insert(userRoleAssignments).values({
    userId,
    roleId,
    assignedByUserId: assignedByUserId ?? null,
  });

  return true;
}

export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  await db.delete(userRoleAssignments).where(
    and(
      eq(userRoleAssignments.userId, userId),
      eq(userRoleAssignments.roleId, roleId),
    )
  );
}

export async function getUserRoles(userId: string): Promise<ReturnType<typeof mapRoleRow>[]> {
  const rows = await db.select({
    id: roles.id,
    name: roles.name,
    code: roles.code,
    scopeType: roles.scopeType,
    scopeKey: roles.scopeKey,
    clientId: roles.clientId,
    description: roles.description,
    isSystem: roles.isSystem,
    createdAt: roles.createdAt,
  }).from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, userId))
    .orderBy(desc(roles.createdAt));

  return rows.map(mapRoleRow);
}

export async function getUserRoleAssignments(userId: string) {
  return db.select({
    assignmentId: userRoleAssignments.id,
    roleId: roles.id,
    roleName: roles.name,
    code: roles.code,
    scopeType: roles.scopeType,
    scopeKey: roles.scopeKey,
    clientId: roles.clientId,
    description: roles.description,
    isSystem: roles.isSystem,
    assignedByUserId: userRoleAssignments.assignedByUserId,
    createdAt: userRoleAssignments.createdAt,
  }).from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, userId))
    .orderBy(desc(userRoleAssignments.createdAt));
}

export async function listUsersWithRoles(): Promise<UserRoleSummary[]> {
  const rows = await db.select({
    id: users.id,
    sub: users.sub,
    email: users.email,
    name: users.name,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
    roleId: roles.id,
    roleName: roles.name,
    roleCode: roles.code,
    roleScopeType: roles.scopeType,
    roleScopeKey: roles.scopeKey,
    roleClientId: roles.clientId,
    roleIsSystem: roles.isSystem,
  }).from(users)
    .leftJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
    .leftJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .orderBy(desc(users.createdAt), desc(roles.createdAt));

  const grouped = new Map<string, UserRoleSummary>();

  for (const row of rows) {
    const current = grouped.get(row.id);

    if (!current) {
      grouped.set(row.id, {
        id: row.id,
        sub: row.sub,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        createdAt: row.createdAt,
        roles: [],
      });
    }

    if (row.roleId) {
      const target = grouped.get(row.id);
      if (target) {
        target.roles.push({
          id: row.roleId,
          name: row.roleName!,
          code: row.roleCode!,
          scopeType: row.roleScopeType as RoleScopeType,
          clientId: row.roleClientId,
          scopeKey: row.roleScopeKey!,
          isSystem: row.roleIsSystem ?? false,
        });
      }
    }
  }

  return Array.from(grouped.values());
}

export async function listAssignableRoles(): Promise<RoleCatalogItem[]> {
  return listRoles();
}

export async function assignRoleToUsers(params: {
  roleId: string;
  userIds: string[];
  assignedByUserId?: string | null;
}): Promise<number> {
  let created = 0;

  for (const userId of params.userIds) {
    const inserted = await ensureUserRole(userId, params.roleId, params.assignedByUserId ?? null);
    if (inserted) {
      created += 1;
    }
  }

  return created;
}

export async function assignRoleToAllUsers(params: {
  roleId: string;
  assignedByUserId?: string | null;
}): Promise<number> {
  const allUsers = await db.select({ id: users.id }).from(users);
  return assignRoleToUsers({
    roleId: params.roleId,
    userIds: allUsers.map((user) => user.id),
    assignedByUserId: params.assignedByUserId ?? null,
  });
}

export async function ensureClientDefaultRole(
  clientId: string,
  roleName = 'Usuário',
  code = DEFAULT_CLIENT_ROLE_CODE
): Promise<typeof roles.$inferSelect> {
  return ensureRoleExists({
    name: roleName,
    code,
    scopeType: 'CLIENT',
    clientId,
    description: `Papel padrão de acesso para o cliente ${clientId}`,
    isSystem: true,
  });
}

export async function ensureGlobalRole(
  code: string,
  name: string,
  description?: string,
  isSystem = true
): Promise<typeof roles.$inferSelect> {
  return ensureRoleExists({
    code,
    name,
    scopeType: 'GLOBAL',
    description: description ?? null,
    isSystem,
  });
}

export async function getDefaultGlobalRoles(): Promise<{
  userRole: typeof roles.$inferSelect;
  adminRole: typeof roles.$inferSelect;
}> {
  const userRole = await ensureGlobalRole(
    DEFAULT_GLOBAL_USER_ROLE_CODE,
    'Usuário',
    'Papel base para contas normais',
    true,
  );

  const adminRole = await ensureGlobalRole(
    JANUS_ADMIN_ROLE_CODE,
    'Administrador do Janus',
    'Papel global para administração do IdP',
    true,
  );

  return { userRole, adminRole };
}

export async function userHasGlobalRole(userId: string, roleCode: string): Promise<boolean> {
  const rows = await db.select({ id: roles.id }).from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(
      eq(userRoleAssignments.userId, userId),
      eq(roles.scopeType, 'GLOBAL'),
      eq(roles.code, roleCode),
    ))
    .limit(1);

  return rows.length > 0;
}

export async function userHasAnyGlobalRole(userId: string, roleCodes: string[]): Promise<boolean> {
  if (roleCodes.length === 0) {
    return false;
  }

  const rows = await db.select({ id: roles.id }).from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(
      eq(userRoleAssignments.userId, userId),
      eq(roles.scopeType, 'GLOBAL'),
      inArray(roles.code, roleCodes),
    ))
    .limit(1);

  return rows.length > 0;
}

export async function userHasClientAccess(
  userId: string,
  clientId: string,
  options: { bypassGlobalRoleCodes?: string[] } = {},
): Promise<boolean> {
  const clientRoleMatch = await db.select({ id: roles.id }).from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(
      eq(userRoleAssignments.userId, userId),
      eq(roles.scopeType, 'CLIENT'),
      eq(roles.clientId, clientId),
    ))
    .limit(1);

  if (clientRoleMatch.length > 0) {
    return true;
  }

  const bypassRoles = options.bypassGlobalRoleCodes ?? [];
  if (bypassRoles.length === 0) {
    return false;
  }

  return userHasAnyGlobalRole(userId, bypassRoles);
}

export async function getRoleAssignmentCount(roleId: string): Promise<number> {
  const rows = await db.select({ id: userRoleAssignments.id }).from(userRoleAssignments)
    .where(eq(userRoleAssignments.roleId, roleId));

  return rows.length;
}

export async function getUsersByIds(userIds: string[]): Promise<typeof users.$inferSelect[]> {
  if (userIds.length === 0) {
    return [];
  }

  return db.select().from(users).where(inArray(users.id, userIds));
}

function mapRoleRow(row: {
  id: string;
  name: string;
  code: string;
  scopeType: string;
  scopeKey: string;
  clientId: string | null;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
}) {
  return {
    ...row,
    scopeType: row.scopeType as RoleScopeType,
  };
}
