import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { db } from '../adapter';
import { schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { ensureServiceKey } from '../middleware/auth';

const router = Router();

const { users, clients, userClients } = schema;

/**
 * Interface para o corpo da requisição de criação de usuário.
 * Inclui clientId para vincular o usuário a um cliente específico.
 */
interface CreateUserBody {
  email: string;
  password: string;
  name?: string;
  clientId: string; // Obrigatório - ID do cliente ao qual o usuário será vinculado
}

/**
 * POST /api/users
 * Cria um novo usuário no sistema e o vincula a um cliente específico.
 *
 * Corpo da requisição:
 * - email: string (obrigatório) - Email do usuário
 * - password: string (obrigatório) - Senha do usuário
 * - name: string (opcional) - Nome do usuário
 * - clientId: string (obrigatório) - ID do cliente para vincular o usuário
 *
 * Headers:
 * - X-Service-Key: string (obrigatório) - Chave de API do serviço
 *
 * Retorna o usuário criado com seu ID.
 *
 * Comportamento idempotente:
 * - Se o usuário já existe e está vinculado ao cliente: retorna 200 OK
 * - Se o usuário é novo: cria usuário, vincula ao cliente e retorna 201 Created
 * - Se o usuário já existe mas não está vinculado ao cliente: cria vínculo e retorna 200 OK
 */
router.post('/users', ensureServiceKey, async (req: Request, res: Response) => {
  try {
    const { email, password, name, clientId } = req.body as CreateUserBody;

    // Validação dos campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email and password are required',
      });
    }

    // Validação do clientId (obrigatório para controle de acesso)
    if (!clientId) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'clientId is required for user-client association',
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

    // Verifica se o cliente existe
    const clientResult = await db.select().from(clients).where(eq(clients.clientId, clientId)).limit(1);
    const client = clientResult[0];

    if (!client) {
      return res.status(400).json({
        error: 'Invalid client',
        message: 'The specified client does not exist',
      });
    }

    // Verifica se já existe um usuário com este email
    const existingResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const existingUser = existingResult[0];

    // Se o usuário já existe, verifica a senha e cria vínculo se necessário
    if (existingUser) {
      // Verifica se a senha está correta
      const isValidPassword = await bcrypt.compare(password, existingUser.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'A user with this email already exists but the password is incorrect',
        });
      }

      // Verifica se o vínculo já existe
      const existingLink = await db.select()
        .from(userClients)
        .where(and(
          eq(userClients.userId, existingUser.id),
          eq(userClients.clientId, clientId)
        ))
        .limit(1);

      if (existingLink.length > 0) {
        // Vínculo já existe - retorna 200 OK (idempotente)
        console.log(`[API] User already linked to client: ${existingUser.email} -> ${clientId}`);
        return res.status(200).json({
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          emailVerified: existingUser.emailVerified,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
          linkedToClient: true,
          isNewLink: false,
        });
      }

      // Cria o vínculo entre usuário existente e cliente
      await db.insert(userClients).values({
        userId: existingUser.id,
        clientId: clientId,
      });

      console.log(`[API] User linked to client: ${existingUser.email} -> ${clientId}`);

      return res.status(200).json({
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        emailVerified: existingUser.emailVerified,
        createdAt: existingUser.createdAt,
        updatedAt: existingUser.updatedAt,
        linkedToClient: true,
        isNewLink: true,
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

    // Cria o vínculo entre usuário e cliente
    await db.insert(userClients).values({
      userId: user.id,
      clientId: clientId,
    });

    console.log(`[API] User created and linked to client: ${user.email} (${user.id}) -> ${clientId}`);

    return res.status(201).json({
      ...user,
      linkedToClient: true,
      isNewLink: true,
    });
  } catch (error) {
    console.error('[API] Error creating user:', error);
    // Não expõe detalhes do erro de banco de dados
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while creating the user',
    });
  }
});

export default router;
