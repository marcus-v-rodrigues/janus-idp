-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "name" TEXT,
    "redirectUris" TEXT[],
    "grantTypes" TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "responseTypes" TEXT[] DEFAULT ARRAY['code']::TEXT[],
    "scope" TEXT DEFAULT 'openid profile email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientId_key" ON "Client"("clientId");
