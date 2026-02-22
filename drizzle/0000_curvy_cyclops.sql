CREATE TYPE "public"."role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
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
CREATE TABLE "UserClient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"clientId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"name" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserClient" ADD CONSTRAINT "UserClient_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserClient" ADD CONSTRAINT "UserClient_clientId_Client_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("clientId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerId_key" ON "Account" USING btree ("provider","providerId");--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "OidcPayload_type_idx" ON "OidcPayload" USING btree ("type");--> statement-breakpoint
CREATE INDEX "OidcPayload_grantId_idx" ON "OidcPayload" USING btree ("grantId");--> statement-breakpoint
CREATE INDEX "OidcPayload_uid_idx" ON "OidcPayload" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "OidcPayload_expiresAt_idx" ON "OidcPayload" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "UserClient_userId_clientId_key" ON "UserClient" USING btree ("userId","clientId");--> statement-breakpoint
CREATE INDEX "UserClient_userId_idx" ON "UserClient" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UserClient_clientId_idx" ON "UserClient" USING btree ("clientId");