import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';
import { ensureServiceKey } from '../middleware/auth';

const router = Router();

const { users } = schema;

/**
 * Interface para o corpo da requisição de criação de usuário.
 */
interface CreateUserBody {
  email: string;
  password: string;
  name?: string;
}

/**
 * POST /api/users
 * Cria um novo usuário no sistema.
 * 
 * Corpo da requisição:
 * - email: string (obrigatório) - Email do usuário
 * - password: string (obrigatório) - Senha do usuário
 * - name: string (opcional) - Nome do usuário
 * 
 * Headers:
 * - X-Service-Key: string (obrigatório) - Chave de API do serviço
 * 
 * Retorna o usuário criado com seu ID.
 */
router.post('/users', ensureServiceKey, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as CreateUserBody;

    // Validação dos campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email and password are required',
      });
    }

    // Validação básica do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'The provided email is not valid',
      });
    }

    // Validação da senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 6 characters long',
      });
    }

    // Verifica se já existe um usuário com este email
    const existingResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const existingUser = existingResult[0];

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    // Cria o hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Cria o usuário no banco de dados
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      name: name || null,
      role: 'USER',
    }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    console.log(`[API] User created via API: ${user.email} (${user.id})`);

    return res.status(201).json(user);
  } catch (error) {
    console.error('[API] Error creating user:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while creating the user',
    });
  }
});

export default router;
