import { Request, Response, NextFunction } from 'express';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';

const { users } = schema;

/**
 * Middleware para garantir que o usuário tenha a função ADMIN.
 * Redireciona para /admin/login se não estiver autenticado ou não for um administrador.
 */
export async function ensureAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Verifica se a sessão de administrador existe
    const adminUserId = req.session?.adminUserId;

    if (!adminUserId) {
      // Sem sessão de administrador, redireciona para login
      return res.redirect('/admin/login');
    }

    // Verifica se o usuário existe e tem a função ADMIN
    const result = await db.select({
      id: users.id,
      role: users.role,
      email: users.email,
      name: users.name,
    }).from(users).where(eq(users.id, adminUserId)).limit(1);
    
    const user = result[0];

    if (!user || user.role !== 'ADMIN') {
      // Usuário não existe ou não é um administrador
      delete req.session?.adminUserId;
      return res.redirect('/admin/login');
    }

    // Anexa o usuário à requisição para uso nas rotas
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Erro no middleware ensureAdmin:', error);
    res.redirect('/admin/login');
  }
}

/**
 * Middleware para garantir que o usuário NÃO esteja logado (para página de login).
 * Redireciona para /admin se já estiver logado como administrador.
 */
export async function ensureNotAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const adminUserId = req.session?.adminUserId;

  if (adminUserId) {
    // Já logado, redireciona para o dashboard
    return res.redirect('/admin');
  }

  next();
}

/**
 * Middleware para autenticação de serviços externos via API Key.
 * Verifica se o header 'X-Service-Key' corresponde à variável de ambiente JANUS_SERVICE_API_KEY.
 * Usado para permitir que serviços externos (como APIs) criem usuários programaticamente.
 */
export function ensureServiceKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceKey = req.headers['x-service-key'];
  const expectedKey = process.env.JANUS_SERVICE_API_KEY;

  if (!expectedKey) {
    console.error('JANUS_SERVICE_API_KEY not configured in environment variables');
    res.status(500).json({ error: 'Service API key not configured' });
    return;
  }

  if (!serviceKey || serviceKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid or missing service key' });
    return;
  }

  next();
}
