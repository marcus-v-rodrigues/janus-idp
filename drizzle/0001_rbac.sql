CREATE TYPE "public"."role_scope_type" AS ENUM('GLOBAL', 'CLIENT');--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sub" uuid;--> statement-breakpoint
UPDATE "User" SET "sub" = "id" WHERE "sub" IS NULL;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "sub" SET NOT NULL;--> statement-breakpoint
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
ALTER TABLE "Role" ADD CONSTRAINT "Role_clientId_Client_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_Role_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_assignedByUserId_User_id_fk" FOREIGN KEY ("assignedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "User_sub_key" ON "User" USING btree ("sub");--> statement-breakpoint
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
SELECT gen_random_uuid(), 'Membro', 'member', 'CLIENT', 'CLIENT:' || c."clientId", c."clientId", 'Papel padrão de acesso para o cliente ' || c."clientId", true, now(), now()
FROM "Client" c
WHERE NOT EXISTS (
	SELECT 1 FROM "Role" r WHERE r."scopeKey" = 'CLIENT:' || c."clientId" AND r."code" = 'member'
);--> statement-breakpoint
INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "assignedByUserId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", r."id", NULL, now(), now()
FROM "User" u
JOIN "Role" r ON r."scopeKey" = 'GLOBAL' AND r."code" = 'user'
WHERE NOT EXISTS (
	SELECT 1 FROM "UserRoleAssignment" ura WHERE ura."userId" = u."id" AND ura."roleId" = r."id"
);--> statement-breakpoint
INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "assignedByUserId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", r."id", NULL, now(), now()
FROM "User" u
JOIN "Role" r ON r."scopeKey" = 'GLOBAL' AND r."code" = 'janus_admin'
WHERE u."role" = 'ADMIN'
AND NOT EXISTS (
	SELECT 1 FROM "UserRoleAssignment" ura WHERE ura."userId" = u."id" AND ura."roleId" = r."id"
);--> statement-breakpoint
INSERT INTO "UserRoleAssignment" ("id", "userId", "roleId", "assignedByUserId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), uc."userId", r."id", NULL, now(), now()
FROM "UserClient" uc
JOIN "Role" r ON r."scopeKey" = 'CLIENT:' || uc."clientId" AND r."code" = 'member'
WHERE NOT EXISTS (
	SELECT 1 FROM "UserRoleAssignment" ura WHERE ura."userId" = uc."userId" AND ura."roleId" = r."id"
);--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";--> statement-breakpoint
DROP TABLE IF EXISTS "UserClient";--> statement-breakpoint
DROP TYPE IF EXISTS "role";--> statement-breakpoint
