import { Request, Response, NextFunction } from 'express';
import { prisma } from '../adapter';
import '../types/express';

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
    const user = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { id: true, role: true, email: true, name: true },
    });

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
