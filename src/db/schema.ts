import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for user roles
export const roleEnum = pgEnum('role', ['USER', 'ADMIN']);

// User table
export const users = pgTable('User', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  name: text('name'),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  role: roleEnum('role').default('USER').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Account table (for OAuth providers)
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

// OIDC Payload table (for oidc-provider adapter)
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

// Client table (OIDC clients)
export const clients = pgTable('Client', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: text('clientId').notNull().unique(),
  clientSecret: text('clientSecret').notNull(),
  name: text('name'),
  logoUri: text('logoUri'),
  brandColor: text('brandColor'),
  redirectUris: text('redirectUris').array().notNull(),
  postLogoutRedirectUris: text('postLogoutRedirectUris').array().notNull().default([]),
  grantTypes: text('grantTypes').array().notNull().default(['authorization_code', 'refresh_token']),
  responseTypes: text('responseTypes').array().notNull().default(['code']),
  scope: text('scope').default('openid profile email'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type OidcPayload = typeof oidcPayloads.$inferSelect;
export type NewOidcPayload = typeof oidcPayloads.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
