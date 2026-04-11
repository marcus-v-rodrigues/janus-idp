import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleScopeEnum = pgEnum('role_scope_type', ['GLOBAL', 'CLIENT']);

export const users = pgTable('User', {
  id: uuid('id').defaultRandom().primaryKey(),
  sub: uuid('sub').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  name: text('name'),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const accounts = pgTable('Account', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').default('oauth').notNull(),
  provider: text('provider').default('local').notNull(),
  providerId: text('providerId').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('Account_provider_providerId_key').on(table.provider, table.providerId),
  index('Account_userId_idx').on(table.userId),
]);

export const oidcPayloads = pgTable('OidcPayload', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: json('payload').notNull().$type<Record<string, any>>(),
  grantId: text('grantId'),
  userCode: text('userCode').unique(),
  uid: text('uid').unique(),
  expiresAt: timestamp('expiresAt'),
  consumedAt: timestamp('consumedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => [
  index('OidcPayload_type_idx').on(table.type),
  index('OidcPayload_grantId_idx').on(table.grantId),
  index('OidcPayload_uid_idx').on(table.uid),
  index('OidcPayload_expiresAt_idx').on(table.expiresAt),
]);

export const clients = pgTable('Client', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: text('clientId').notNull().unique(),
  clientSecret: text('clientSecret').notNull(),
  name: text('name'),
  logoUri: text('logoUri'),
  brandColor: text('brandColor'),
  redirectUris: text('redirectUris').array().notNull(),
  postLogoutRedirectUris: text('postLogoutRedirectUris').array().notNull().default([]),
  grantTypes: text('grantTypes').array().notNull().default(['authorization_code']),
  responseTypes: text('responseTypes').array().notNull().default(['code']),
  scope: text('scope').default('openid profile email'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const roles = pgTable('Role', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  scopeType: roleScopeEnum('scopeType').notNull(),
  scopeKey: text('scopeKey').notNull(),
  clientId: text('clientId').references(() => clients.clientId, { onDelete: 'cascade' }),
  description: text('description'),
  isSystem: boolean('isSystem').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('Role_scopeKey_code_key').on(table.scopeKey, table.code),
  index('Role_scopeType_idx').on(table.scopeType),
  index('Role_clientId_idx').on(table.clientId),
]);

export const userRoleAssignments = pgTable('UserRoleAssignment', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('roleId').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedByUserId: uuid('assignedByUserId').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('UserRoleAssignment_userId_roleId_key').on(table.userId, table.roleId),
  index('UserRoleAssignment_userId_idx').on(table.userId),
  index('UserRoleAssignment_roleId_idx').on(table.roleId),
]);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  roleAssignments: many(userRoleAssignments),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many, one }) => ({
  assignments: many(userRoleAssignments),
  client: one(clients, {
    fields: [roles.clientId],
    references: [clients.clientId],
  }),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRoleAssignments.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoleAssignments.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoleAssignments.assignedByUserId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  roles: many(roles),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type OidcPayload = typeof oidcPayloads.$inferSelect;
export type NewOidcPayload = typeof oidcPayloads.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type NewUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
