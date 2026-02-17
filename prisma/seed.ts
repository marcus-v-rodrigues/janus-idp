import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Create or verify admin user
 * This function is idempotent - it will only create the user if it doesn't exist
 */
async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`✓ Usuário admin (${adminEmail}) já existe.`);
    return;
  }

  // Hash the password
  const passwordHash = await hashPassword(adminPassword);

  // Create admin user
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: passwordHash,
      name: adminName,
      emailVerified: true,
    },
  });

  console.log(`✓ Usuário admin (${adminEmail}) criado com sucesso!`);
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Senha: ${adminPassword}`);
  console.log(`  ⚠️  Lembre-se de alterar a senha após o primeiro login em produção!`);
}

/**
 * Seed OIDC clients
 * This function is idempotent - it will only create clients that don't exist
 */
async function seedClients(): Promise<void> {
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
    console.log('✓ Cliente de teste inserido com sucesso!');
  } else {
    console.log('✓ Cliente de teste já existe.');
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
    console.log('✓ Cliente ux-auditor inserido com sucesso!');
  } else {
    console.log('✓ Cliente ux-auditor já existe.');
  }

  // ============================================================================
  // FUTURO: Client do Dashboard
  // ============================================================================
  // Se decidirmos mover os Clients para o banco no futuro, use a estrutura abaixo
  // para inserir o client do dashboard:
  //
  // const dashboardClientId = 'janus-dashboard';
  // const dashboardClientExists = await prisma.client.findUnique({
  //   where: { clientId: dashboardClientId },
  // });
  //
  // if (!dashboardClientExists) {
  //   await prisma.client.create({
  //     data: {
  //       clientId: dashboardClientId,
  //       clientSecret: process.env.DASHBOARD_CLIENT_SECRET || 'change_me_in_production',
  //       name: 'Janus Dashboard',
  //       redirectUris: [
  //         `https://${process.env.DASHBOARD_DOMAIN || 'dashboard.seudominio.com'}/auth/callback`
  //       ],
  //       postLogoutRedirectUris: [
  //         `https://${process.env.DASHBOARD_DOMAIN || 'dashboard.seudominio.com'}/`
  //       ],
  //       grantTypes: ['authorization_code', 'refresh_token'],
  //       responseTypes: ['code'],
  //       scope: 'openid profile email'
  //     }
  //   });
  //   console.log('✓ Client do Dashboard inserido com sucesso!');
  // } else {
  //   console.log('✓ Client do Dashboard já existe.');
  // }
  // ============================================================================
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Ambiente de produção detectado.');
    console.log('   O seed será executado com cautela. Verifique as credenciais!\n');
  }

  // Seed admin user
  await seedAdminUser();
  console.log('');

  // Seed clients
  await seedClients();
  console.log('');

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
