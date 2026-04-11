import 'dotenv/config';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { schema } from '../src/db';
import {
  DEFAULT_CLIENT_ROLE_CODE,
  DEFAULT_GLOBAL_USER_ROLE_CODE,
  JANUS_ADMIN_ROLE_CODE,
  ensureClientDefaultRole,
  ensureGlobalRole,
  ensureUserRole,
  getDefaultGlobalRoles,
} from '../src/services/rbac';

const { users, clients } = schema;

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  const existingResult = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  const existingAdmin = existingResult[0];

  const { userRole, adminRole } = await getDefaultGlobalRoles();

  let adminUser = existingAdmin;

  if (!existingAdmin) {
    const passwordHash = await hashPassword(adminPassword);
    const subject = crypto.randomUUID();

    const [created] = await db.insert(users).values({
      id: subject,
      sub: subject,
      email: adminEmail,
      passwordHash,
      name: adminName,
      emailVerified: true,
    }).returning();

    adminUser = created;

    console.log(`✓ Usuário admin (${adminEmail}) criado com sucesso.`);
    console.log(`  sub: ${adminUser.sub}`);
  } else {
    console.log(`✓ Usuário admin (${adminEmail}) já existe.`);
  }

  if (!adminUser) {
    throw new Error('Não foi possível carregar o usuário administrador.');
  }

  await ensureUserRole(adminUser.id, userRole.id, null);
  await ensureUserRole(adminUser.id, adminRole.id, null);

  console.log(`✓ Papéis globais atribuídos ao admin: ${DEFAULT_GLOBAL_USER_ROLE_CODE}, ${JANUS_ADMIN_ROLE_CODE}`);
}

async function seedClients(): Promise<void> {
  const testClientId = process.env.OIDC_CLIENT_ID || 'test-client';
  const auditorClientId = process.env.UX_CLIENT_ID || 'ux-auditor';
  const baseDomain = process.env.UX_BASE_DOMAIN || 'dashboard.seudominio.com';

  const clientsToSeed = [
    {
      clientId: testClientId,
      clientSecret: process.env.OIDC_CLIENT_SECRET || 'test-secret',
      name: 'OIDC Debugger Client',
      redirectUris: (process.env.OIDC_REDIRECT_URIS || 'https://oidcdebugger.com/debug').split(',').map((value) => value.trim()),
    },
    {
      clientId: auditorClientId,
      clientSecret: process.env.UX_CLIENT_SECRET || 'janus_dashboard_secret',
      name: 'UX Auditor',
      redirectUris: [`${baseDomain}/api/auth/callback/janus`],
    },
  ];

  for (const clientData of clientsToSeed) {
    const existing = await db.select().from(clients).where(eq(clients.clientId, clientData.clientId)).limit(1);
    const client = existing[0];

    if (!client) {
      await db.insert(clients).values({
        clientId: clientData.clientId,
        clientSecret: clientData.clientSecret,
        name: clientData.name,
        redirectUris: clientData.redirectUris,
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scope: 'openid profile email offline_access',
      });
      console.log(`✓ Cliente ${clientData.clientId} inserido com sucesso.`);
    } else {
      console.log(`✓ Cliente ${clientData.clientId} já existe.`);
    }

    const defaultRole = await ensureClientDefaultRole(clientData.clientId, 'Membro', DEFAULT_CLIENT_ROLE_CODE);
    console.log(`✓ Papel padrão garantido para ${clientData.clientId}: ${defaultRole.code}`);
  }
}

async function seedRoleAssignmentsForAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
  const adminResult = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  const adminUser = adminResult[0];

  if (!adminUser) {
    console.log('⚠️  Usuário admin não encontrado para atribuições de cliente.');
    return;
  }

  const clientRows = await db.select().from(clients);
  for (const clientRow of clientRows) {
    const clientRole = await ensureClientDefaultRole(clientRow.clientId, 'Membro', DEFAULT_CLIENT_ROLE_CODE);
    await ensureUserRole(adminUser.id, clientRole.id, null);
    console.log(`✓ Papel ${clientRole.code} atribuído ao admin para ${clientRow.clientId}`);
  }
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Ambiente de produção detectado.');
    console.log('   O seed será executado com cautela. Verifique as credenciais!\n');
  }

  await seedAdminUser();
  console.log('');

  await seedClients();
  console.log('');

  await seedRoleAssignmentsForAdmin();
  console.log('');

  console.log('✅ Seed concluído com sucesso!');
}

main().catch((error) => {
  console.error('❌ Erro ao executar seed:', error);
  process.exit(1);
});
