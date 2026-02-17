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

  // Seed do cliente de teste (OIDC Debugger)
  // NOTA: As variáveis de ambiente OIDC_CLIENT_* são usadas apenas aqui no seed
  // para criar o cliente no banco. O servidor carrega todos os clientes dinamicamente
  // do banco em src/index.ts.
  const testClientId = process.env.OIDC_CLIENT_ID || 'test_client';
  const testExists = await prisma.client.findUnique({
    where: { clientId: testClientId },
  });

  if (!testExists) {
    await prisma.client.create({
      data: {
        clientId: testClientId,
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

  // Seed do cliente ux-auditor
  // NOTA: As variáveis de ambiente JANUS_* são usadas apenas aqui no seed
  // para criar o cliente no banco. O servidor carrega todos os clientes dinamicamente
  // do banco em src/index.ts.
  const auditorClientId = process.env.JANUS_CLIENT_ID || 'ux-auditor';
  const baseDomain = process.env.JANUS_BASE_DOMAIN || 'dashboard.seudominio.com';
  const dashboardExists = await prisma.client.findUnique({
    where: { clientId: auditorClientId },
  });

  if (!dashboardExists) {
    await prisma.client.create({
      data: {
        clientId: auditorClientId,
        clientSecret: process.env.JANUS_CLIENT_SECRET || 'janus_dashboard_secret',
        name: 'UX Auditor',
        redirectUris: [`https://${baseDomain}/api/auth/callback/janus`],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        scope: 'openid profile email'
      }
    });
    console.log('Cliente ux-auditor inserido com sucesso!');
  } else {
    console.log('Cliente ux-auditor já existe.');
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
