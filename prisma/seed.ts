import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️ Ambiente de produção detectado. O seed de teste não será executado.');
    return;
  }

  const clientId = process.env.OIDC_CLIENT_ID || 'test_client';

  // Verifica se já existe para não duplicar
  const exists = await prisma.client.findUnique({
    where: { clientId },
  });

  if (!exists) {
    await prisma.client.create({
      data: {
        clientId: clientId,
        clientSecret: process.env.OIDC_CLIENT_SECRET || 'test_secret',
        name: 'OIDC Debugger Client',
        redirectUris: (process.env.OIDC_REDIRECT_URIS || 'https://oidcdebugger.com/debug').split(','),
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        scope: 'openid profile email'
      }
    });
    console.log('Cliente de teste inserido com sucesso!');
  } else {
    console.log('Cliente de teste já existe.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
