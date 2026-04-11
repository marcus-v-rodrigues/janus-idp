CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."role_scope_type" AS ENUM('GLOBAL', 'CLIENT');--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" uuid NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"name" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" text DEFAULT 'oauth' NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"providerId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" text NOT NULL,
	"clientSecret" text NOT NULL,
	"name" text,
	"logoUri" text,
	"brandColor" text,
	"redirectUris" text[] NOT NULL,
	"postLogoutRedirectUris" text[] DEFAULT '{}' NOT NULL,
	"grantTypes" text[] DEFAULT '{"authorization_code","refresh_token"}' NOT NULL,
	"responseTypes" text[] DEFAULT '{"code"}' NOT NULL,
	"scope" text DEFAULT 'openid profile email',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Client_clientId_unique" UNIQUE("clientId")
);
--> statement-breakpoint
CREATE TABLE "OidcPayload" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" json NOT NULL,
	"grantId" text,
	"userCode" text,
	"uid" text,
	"expiresAt" timestamp,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "OidcPayload_userCode_unique" UNIQUE("userCode"),
	CONSTRAINT "OidcPayload_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "Role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"scopeType" "role_scope_type" NOT NULL,
	"scopeKey" text NOT NULL,
	"clientId" text,
	"description" text,
	"isSystem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserRoleAssignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"roleId" uuid NOT NULL,
	"assignedByUserId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Role" ADD CONSTRAINT "Role_clientId_Client_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_Role_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_assignedByUserId_User_id_fk" FOREIGN KEY ("assignedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "User_sub_key" ON "User" USING btree ("sub");--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerId_key" ON "Account" USING btree ("provider","providerId");--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "OidcPayload_type_idx" ON "OidcPayload" USING btree ("type");--> statement-breakpoint
CREATE INDEX "OidcPayload_grantId_idx" ON "OidcPayload" USING btree ("grantId");--> statement-breakpoint
CREATE INDEX "OidcPayload_uid_idx" ON "OidcPayload" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "OidcPayload_expiresAt_idx" ON "OidcPayload" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Role_scopeKey_code_key" ON "Role" USING btree ("scopeKey","code");--> statement-breakpoint
CREATE INDEX "Role_scopeType_idx" ON "Role" USING btree ("scopeType");--> statement-breakpoint
CREATE INDEX "Role_clientId_idx" ON "Role" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment" USING btree ("userId","roleId");--> statement-breakpoint
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment" USING btree ("roleId");--> statement-breakpoint
INSERT INTO "Role" ("id", "name", "code", "scopeType", "scopeKey", "clientId", "description", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Usuário', 'user', 'GLOBAL', 'GLOBAL', NULL, 'Papel base para contas normais', true, now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM "Role" WHERE "scopeKey" = 'GLOBAL' AND "code" = 'user'
);--> statement-breakpoint
INSERT INTO "Role" ("id", "name", "code", "scopeType", "scopeKey", "clientId", "description", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Administrador do Janus', 'janus_admin', 'GLOBAL', 'GLOBAL', NULL, 'Papel global para administração do IdP', true, now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM "Role" WHERE "scopeKey" = 'GLOBAL' AND "code" = 'janus_admin'
);--> statement-breakpoint
INSERT INTO "Role" ("id", "name", "code", "scopeType", "scopeKey", "clientId", "description", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Usuário', 'user', 'CLIENT', 'CLIENT:' || c."clientId", c."clientId", 'Papel padrão de acesso para o cliente ' || c."clientId", true, now(), now()
FROM "Client" c
WHERE NOT EXISTS (
	SELECT 1 FROM "Role" r WHERE r."scopeKey" = 'CLIENT:' || c."clientId" AND r."code" = 'user'
);--> statement-breakpoint
