import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';
import { ensureServiceKey } from '../middleware/auth';
import {
  DEFAULT_CLIENT_ROLE_CODE,
  DEFAULT_GLOBAL_USER_ROLE_CODE,
  ensureClientDefaultRole,
  ensureGlobalRole,
  ensureUserRole,
  getUserRoles,
} from '../services/rbac';

const router = Router();

const { users, clients } = schema;

interface CreateUserBody {
  email: string;
  password: string;
  name?: string;
  clientId?: string;
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

router.post('/users', ensureServiceKey, async (req: Request, res: Response) => {
  try {
    const { email, password, name, clientId } = req.body as CreateUserBody;

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

    let client = null;
    if (clientId) {
      const clientResult = await db.select().from(clients).where(eq(clients.clientId, clientId)).limit(1);
      client = clientResult[0] ?? null;

      if (!client) {
        return res.status(400).json({
          error: 'Invalid client',
          message: 'The specified client does not exist',
        });
      }
    }

    const existingResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const existingUser = existingResult[0];

    if (existingUser) {
      const isValidPassword = await bcrypt.compare(password, existingUser.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'A user with this email already exists but the password is incorrect',
        });
      }

      const userRole = await ensureGlobalRole(
        DEFAULT_GLOBAL_USER_ROLE_CODE,
        'Usuário',
        'Papel base para contas normais',
        true,
      );
      await ensureUserRole(existingUser.id, userRole.id, null);

      if (clientId && client) {
        const clientRole = await ensureClientDefaultRole(client.clientId);
        await ensureUserRole(existingUser.id, clientRole.id, null);
      }

      const response = await formatUserResponse(existingUser);

      return res.status(200).json({
        ...response,
        created: false,
        clientRoleCode: clientId ? DEFAULT_CLIENT_ROLE_CODE : null,
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

    const userRole = await ensureGlobalRole(
      DEFAULT_GLOBAL_USER_ROLE_CODE,
      'Usuário',
      'Papel base para contas normais',
      true,
    );
    await ensureUserRole(user.id, userRole.id, null);

    let clientRoleCode: string | null = null;
    if (clientId && client) {
      const clientRole = await ensureClientDefaultRole(client.clientId);
      clientRoleCode = clientRole.code;
      await ensureUserRole(user.id, clientRole.id, null);
    }

    const response = await formatUserResponse(user);

    return res.status(201).json({
      ...response,
      created: true,
      clientRoleCode,
    });
  } catch (error) {
    console.error('[API] Erro ao criar usuário:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while creating the user',
    });
  }
});

export default router;
