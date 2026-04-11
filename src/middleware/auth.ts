import { Request, Response, NextFunction } from 'express';
import { db } from '../adapter';
import { schema } from '../db';
import { and, eq } from 'drizzle-orm';
import { userHasAnyGlobalRole } from '../services/rbac';

const { users } = schema;

export async function ensureGlobalRole(
  roleCode: string,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUserSub = req.session?.adminUserSub;

    if (!adminUserSub) {
      return res.redirect('/admin/login');
    }

    const result = await db.select({
      id: users.id,
      sub: users.sub,
      email: users.email,
      name: users.name,
    }).from(users).where(eq(users.sub, adminUserSub)).limit(1);

    const user = result[0];

    if (!user) {
      delete req.session?.adminUserSub;
      return res.redirect('/admin/login');
    }

    const hasRole = await userHasAnyGlobalRole(user.id, [roleCode]);
    if (!hasRole) {
      delete req.session?.adminUserSub;
      return res.redirect('/admin/login');
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de autorização:', error);
    res.redirect('/admin/login');
  }
}

export function requireGlobalRole(roleCode: string) {
  return (req: Request, res: Response, next: NextFunction) =>
    ensureGlobalRole(roleCode, req, res, next);
}

export function requireAnyGlobalRole(roleCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserSub = req.session?.adminUserSub;

      if (!adminUserSub) {
        return res.redirect('/admin/login');
      }

      const result = await db.select({
        id: users.id,
        sub: users.sub,
        email: users.email,
        name: users.name,
      }).from(users).where(eq(users.sub, adminUserSub)).limit(1);

      const user = result[0];

      if (!user) {
        delete req.session?.adminUserSub;
        return res.redirect('/admin/login');
      }

      const hasRole = await userHasAnyGlobalRole(user.id, roleCodes);
      if (!hasRole) {
        delete req.session?.adminUserSub;
        return res.redirect('/admin/login');
      }

      req.adminUser = user;
      next();
    } catch (error) {
      console.error('Erro no middleware de autorização:', error);
      res.redirect('/admin/login');
    }
  };
}

export async function ensureAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return ensureGlobalRole('janus_admin', req, res, next);
}

export async function ensureNotAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const adminUserSub = req.session?.adminUserSub;

  if (adminUserSub) {
    return res.redirect('/admin');
  }

  next();
}

export function ensureServiceKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceKey = req.headers['x-service-key'];
  const expectedKey = process.env.JANUS_SERVICE_API_KEY;

  if (!expectedKey) {
    console.error('JANUS_SERVICE_API_KEY não configurada nas variáveis de ambiente');
    res.status(500).json({ error: 'Service API key not configured' });
    return;
  }

  if (!serviceKey || serviceKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid or missing service key' });
    return;
  }

  next();
}
