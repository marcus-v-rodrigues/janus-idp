import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';
import { ensureServiceKey } from '../middleware/auth';
import {
  DEFAULT_GLOBAL_USER_ROLE_CODE,
  ensureGlobalRole,
  ensureUserRole,
  getUserRoles,
  getRoleByScopeAndCode,
  removeUserRole,
} from '../services/rbac';

const router = Router();

const { users, clients } = schema;

interface CreateUserBody {
  email: string;
  password: string;
  name?: string;
}

interface RoleAssignmentBody {
  email: string;
  clientId: string;
  roleCode: string;
  action: 'add' | 'remove';
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function formatUserResponse(user: typeof users.$inferSelect) {
  const roles = await getUserRoles(user.id);
  const globalRoles = roles.filter((role) => role.scopeType === 'GLOBAL');
  const clientRoles = roles.filter((role) => role.scopeType === 'CLIENT');

  return {
    id: user.id,
    sub: user.sub,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    globalRoles: globalRoles.map((role) => role.code),
    clientRoles: clientRoles.map((role) => ({
      code: role.code,
      clientId: role.clientId,
    })),
  };
}

router.post('/register', ensureServiceKey, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as CreateUserBody;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email and password are required',
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'The provided email is not valid',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 6 characters long',
      });
    }

    const existingResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const existingUser = existingResult[0];

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const subject = crypto.randomUUID();

    const [user] = await db.insert(users).values({
      id: subject,
      sub: subject,
      email,
      passwordHash,
      name: name || null,
      emailVerified: false,
    }).returning();

    // Atribui apenas o papel básico global
    const userRole = await ensureGlobalRole(
      DEFAULT_GLOBAL_USER_ROLE_CODE,
      'Usuário',
      'Papel base para contas normais',
      true,
    );
    await ensureUserRole(user.id, userRole.id, null);

    const response = await formatUserResponse(user);

    return res.status(201).json({
      ...response,
      created: true,
    });
  } catch (error) {
    console.error('[API] Erro ao criar usuário:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while creating the user',
    });
  }
});

/**
 * Endpoint para gerenciar atribuições de papéis de cliente via API.
 * Permite que um cliente adicione ou remova papéis de seus usuários.
 */
router.post('/roles/assignments', ensureServiceKey, async (req: Request, res: Response) => {
  try {
    const { email, clientId, roleCode, action } = req.body as RoleAssignmentBody;

    if (!email || !clientId || !roleCode || !action) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email, clientId, roleCode and action (add|remove) are required',
      });
    }

    // Busca o usuário
    const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userResult[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Busca o cliente
    const clientResult = await db.select().from(clients).where(eq(clients.clientId, clientId)).limit(1);
    if (!clientResult[0]) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Busca o papel
    const role = await getRoleByScopeAndCode('CLIENT', roleCode, clientId);
    if (!role) {
      return res.status(404).json({ 
        error: 'Role not found', 
        message: `Role '${roleCode}' not found for client '${clientId}'` 
      });
    }

    if (action === 'add') {
      await ensureUserRole(user.id, role.id, null);
      console.log(`[API] Papel '${roleCode}' adicionado ao usuário ${email} para o cliente ${clientId}`);
    } else if (action === 'remove') {
      await removeUserRole(user.id, role.id);
      console.log(`[API] Papel '${roleCode}' removido do usuário ${email} para o cliente ${clientId}`);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "add" or "remove".' });
    }

    const response = await formatUserResponse(user);
    return res.status(200).json(response);

  } catch (error) {
    console.error('[API] Erro ao gerenciar papel:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while managing role assignment',
    });
  }
});

export default router;
