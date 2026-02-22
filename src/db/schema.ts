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

// Enum para papéis de usuário
export const roleEnum = pgEnum('role', ['USER', 'ADMIN']);

// Tabela de usuários
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

// Tabela de contas (para provedores OAuth)
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

// Tabela de payloads OIDC (para o adaptador oidc-provider)
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

// Tabela de clientes OIDC
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

// Tabela de vínculo entre usuários e clientes (controle de acesso granular)
// Esta tabela gerencia a relação many-to-many entre users e clients,
// permitindo controlar quais usuários podem acessar quais aplicações cliente
export const userClients = pgTable('UserClient', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: text('clientId').notNull().references(() => clients.clientId, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => [
  // Índice único composto para evitar vínculos duplicados
  uniqueIndex('UserClient_userId_clientId_key').on(table.userId, table.clientId),
  // Índice para buscas por userId
  index('UserClient_userId_idx').on(table.userId),
  // Índice para buscas por clientId
  index('UserClient_clientId_idx').on(table.clientId),
]);

// Relações
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  userClients: many(userClients),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Relação da tabela userClients com users e clients
export const userClientsRelations = relations(userClients, ({ one }) => ({
  user: one(users, {
    fields: [userClients.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [userClients.clientId],
    references: [clients.clientId],
  }),
}));

// Relação da tabela clients com userClients
export const clientsRelations = relations(clients, ({ many }) => ({
  userClients: many(userClients),
}));

// Exportações de tipos
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type OidcPayload = typeof oidcPayloads.$inferSelect;
export type NewOidcPayload = typeof oidcPayloads.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type UserClient = typeof userClients.$inferSelect;
export type NewUserClient = typeof userClients.$inferInsert;
