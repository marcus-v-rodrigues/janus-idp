import 'dotenv/config';
import { db } from '../src/db';
import { schema } from '../src/db';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

const { users, clients, userClients } = schema;

/**
 * Faz hash de uma senha usando bcrypt
 * @param password - Senha em texto simples
 * @returns Senha com hash
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Cria ou verifica o usuário administrador
 * Esta função é idempotente - ela só criará o usuário se ele não existir
 */
async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  // Verifica se o usuário administrador já existe
  const existingResult = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  const existingAdmin = existingResult[0];

  if (existingAdmin) {
    console.log(`✓ Usuário admin (${adminEmail}) já existe.`);
    return;
  }

  // Faz hash da senha
  const passwordHash = await hashPassword(adminPassword);

  // Cria o usuário administrador
  await db.insert(users).values({
    email: adminEmail,
    passwordHash: passwordHash,
    name: adminName,
    emailVerified: true,
    role: 'ADMIN',
  });

  console.log(`✓ Usuário admin (${adminEmail}) criado com sucesso!`);
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Senha: ${adminPassword}`);
  console.log(`  ⚠️  Lembre-se de alterar a senha após o primeiro login em produção!`);
}

/**
 * Popula clientes OIDC
 * Esta função é idempotente - ela só criará clientes que não existem
 */
async function seedClients(): Promise<void> {
  // Popula o cliente de teste (OIDC Debugger)
  // NOTA: As variáveis de ambiente OIDC_CLIENT_* são usadas apenas aqui no seed
  // para criar o cliente no banco. O servidor carrega todos os clientes dinamicamente
  // do banco em src/index.ts.
  const testClientId = process.env.OIDC_CLIENT_ID || 'test-client';
  const testResult = await db.select().from(clients).where(eq(clients.clientId, testClientId)).limit(1);
  const testExists = testResult[0];

  if (!testExists) {
    await db.insert(clients).values({
      clientId: testClientId,
      clientSecret: process.env.OIDC_CLIENT_SECRET || 'test-secret',
      name: 'OIDC Debugger Client',
      redirectUris: (process.env.OIDC_REDIRECT_URIS || 'https://oidcdebugger.com/debug').split(','),
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scope: 'openid profile email offline_access'
    });
    console.log('✓ Cliente de teste inserido com sucesso!');
  } else {
    console.log('✓ Cliente de teste já existe.');
  }

  // Popula o cliente ux-auditor
  // NOTA: As variáveis de ambiente JANUS_* são usadas apenas aqui no seed
  // para criar o cliente no banco. O servidor carrega todos os clientes dinamicamente
  // do banco em src/index.ts.
  const auditorClientId = process.env.UX_CLIENT_ID || 'ux-auditor';
  const baseDomain = process.env.UX_BASE_DOMAIN || 'dashboard.seudominio.com';
  const auditorResult = await db.select().from(clients).where(eq(clients.clientId, auditorClientId)).limit(1);
  const dashboardExists = auditorResult[0];

  if (!dashboardExists) {
    await db.insert(clients).values({
      clientId: auditorClientId,
      clientSecret: process.env.UX_CLIENT_SECRET || 'janus_dashboard_secret',
      name: 'UX Auditor',
      redirectUris: [`${baseDomain}/api/auth/callback/janus`],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scope: 'openid profile email offline_access'
    });
    console.log('✓ Cliente ux-auditor inserido com sucesso!');
  } else {
    console.log('✓ Cliente ux-auditor já existe.');
  }

  // ============================================================================
  // FUTURO: Cliente do Dashboard
  // ============================================================================
  // Se decidirmos mover os Clients para o banco no futuro, use a estrutura abaixo
  // para inserir o cliente do dashboard:
  //
  // const dashboardClientId = 'janus-dashboard';
  // const dashboardClientResult = await db.select().from(clients).where(eq(clients.clientId, dashboardClientId)).limit(1);
  // const dashboardClientExists = dashboardClientResult[0];
  //
  // if (!dashboardClientExists) {
  //   await db.insert(clients).values({
  //     clientId: dashboardClientId,
  //     clientSecret: process.env.DASHBOARD_CLIENT_SECRET || 'change_me_in_production',
  //     name: 'Janus Dashboard',
  //     redirectUris: [
  //       `https://${process.env.DASHBOARD_DOMAIN || 'dashboard.seudominio.com'}/auth/callback`
  //     ],
  //     postLogoutRedirectUris: [
  //       `https://${process.env.DASHBOARD_DOMAIN || 'dashboard.seudominio.com'}/`
  //     ],
  //     grantTypes: ['authorization_code'],
  //     responseTypes: ['code'],
  //     scope: 'openid profile email'
  //   });
  //   console.log('✓ Client do Dashboard inserido com sucesso!');
  // } else {
  //   console.log('✓ Client do Dashboard já existe.');
  // }
  // ============================================================================
}

/**
 * Popula os vínculos entre usuários e clientes
 * Esta função é idempotente - ela só criará vínculos que não existem
 */
async function seedUserClients(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
  const testClientId = process.env.OIDC_CLIENT_ID || 'test-client';
  const auditorClientId = process.env.UX_CLIENT_ID || 'ux-auditor';

  // Busca o usuário admin
  const adminResult = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  const adminUser = adminResult[0];

  if (!adminUser) {
    console.log('⚠️  Usuário admin não encontrado. Execute o seed de usuários primeiro.');
    return;
  }

  // Lista de clientes para vincular ao usuário admin
  const clientIds = [testClientId, auditorClientId];

  for (const clientId of clientIds) {
    // Verifica se o vínculo já existe
    const existingLink = await db.select()
      .from(userClients)
      .where(and(
        eq(userClients.userId, adminUser.id),
        eq(userClients.clientId, clientId)
      ))
      .limit(1);

    if (existingLink.length === 0) {
      // Cria o vínculo
      await db.insert(userClients).values({
        userId: adminUser.id,
        clientId: clientId,
      });
      console.log(`✓ Vínculo criado: usuário ${adminEmail} -> cliente ${clientId}`);
    } else {
      console.log(`✓ Vínculo já existe: usuário ${adminEmail} -> cliente ${clientId}`);
    }
  }
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Ambiente de produção detectado.');
    console.log('   O seed será executado com cautela. Verifique as credenciais!\n');
  }

  // Popula o usuário administrador
  await seedAdminUser();
  console.log('');

  // Popula os clientes
  await seedClients();
  console.log('');

  // Popula os vínculos entre usuários e clientes
  // await seedUserClients();
  console.log('');

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  });
