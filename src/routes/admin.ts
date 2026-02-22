import { Router, Request, Response } from 'express';
import { db } from '../adapter';
import { schema } from '../db';
import { eq, count, desc } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { ensureAdmin, ensureNotAdmin } from '../middleware/auth';
import { renderView } from '../utils/renderer';

// Importa as visualizações de admin
import { Dashboard } from '../views/admin/Dashboard';
import { ClientsList } from '../views/admin/ClientsList';
import { ClientsForm } from '../views/admin/ClientsForm';
import { UsersList } from '../views/admin/UsersList';
import { AdminLogin } from '../views/admin/AdminLogin';

const router = Router();

const { users, clients } = schema;

/**
 * GET /admin/login - Página de login do administrador
 */
router.get('/login', ensureNotAdmin, (req: Request, res: Response) => {
  renderView(res, AdminLogin, { error: null }, { 
    title: 'Admin Login',
    componentName: 'AdminLogin',
    enableHydration: true 
  });
});

/**
 * POST /admin/login - Submissão do login do administrador
 */
router.post('/login', ensureNotAdmin, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return renderView(res, AdminLogin, { error: 'Por favor, forneça email e senha' }, { title: 'Admin Login' });
  }

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user) {
      return renderView(res, AdminLogin, { error: 'Credenciais inválidas' }, { title: 'Admin Login' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return renderView(res, AdminLogin, { error: 'Credenciais inválidas' }, { title: 'Admin Login' });
    }

    if (user.role !== 'ADMIN') {
      return renderView(res, AdminLogin, { error: 'Acesso negado. Apenas administradores.' }, { title: 'Admin Login' });
    }

    // Define a sessão de administrador
    req.session!.adminUserId = user.id;
    res.redirect('/admin');
  } catch (error) {
    console.error('Erro de login:', error);
    renderView(res, AdminLogin, { error: 'Ocorreu um erro. Por favor, tente novamente.' }, { title: 'Admin Login' });
  }
});

/**
 * GET /admin/logout - Logout do administrador
 */
router.get('/logout', (req: Request, res: Response) => {
  delete req.session?.adminUserId;
  res.redirect('/admin/login');
});

/**
 * GET /admin - Dashboard do administrador
 */
router.get('/', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [totalClientsResult] = await db.select({ count: count() }).from(clients);
    const [activeAdminsResult] = await db.select({ count: count() }).from(users).where(eq(users.role, 'ADMIN'));

    renderView(res, Dashboard, {
      stats: { 
        totalUsers: totalUsersResult.count, 
        totalClients: totalClientsResult.count, 
        activeAdmins: activeAdminsResult.count 
      },
      sidebarLinks: getSidebarLinks('dashboard'),
    }, { 
      title: 'Dashboard',
      componentName: 'Dashboard',
      enableHydration: true 
    });
  } catch (error) {
    console.error('Erro do dashboard:', error);
    res.status(500).send('Erro ao carregar dashboard');
  }
});

/**
 * GET /admin/clients - Lista de clientes
 */
router.get('/clients', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));

    renderView(res, ClientsList, {
      clients: allClients,
      sidebarLinks: getSidebarLinks('clients'),
    }, { 
      title: 'Clients',
      componentName: 'ClientsList',
      enableHydration: true 
    });
  } catch (error) {
    console.error('Erro na lista de clientes:', error);
    res.status(500).send('Erro ao carregar clientes');
  }
});

/**
 * GET /admin/clients/new - Formulário de novo cliente
 */
router.get('/clients/new', ensureAdmin, (req: Request, res: Response) => {
  renderView(res, ClientsForm, {
    client: null,
    error: null,
    sidebarLinks: getSidebarLinks('clients'),
  }, { 
    title: 'New Client',
    componentName: 'ClientsForm',
    enableHydration: true 
  });
});

/**
 * GET /admin/clients/:id/edit - Formulário de edição de cliente
 */
router.get('/clients/:id/edit', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(clients).where(eq(clients.id, req.params.id as string)).limit(1);
    const client = result[0];

    if (!client) {
      return res.redirect('/admin/clients');
    }

    renderView(res, ClientsForm, {
      client,
      error: null,
      sidebarLinks: getSidebarLinks('clients'),
    }, { 
      title: 'Edit Client',
      componentName: 'ClientsForm',
      enableHydration: true 
    });
  } catch (error) {
    console.error('Erro na edição do cliente:', error);
    res.redirect('/admin/clients');
  }
});

/**
 * POST /admin/clients - Criar ou atualizar cliente
 */
router.post('/clients', ensureAdmin, async (req: Request, res: Response) => {
  const { id, name, clientId, clientSecret, redirectUris, postLogoutRedirectUris, grantTypes, responseTypes, scope, logoUri, brandColor } = req.body;

  try {
    const data = {
      name: name || null,
      clientId,
      clientSecret,
      redirectUris: Array.isArray(redirectUris) ? redirectUris : redirectUris.split(',').map((s: string) => s.trim()),
      postLogoutRedirectUris: Array.isArray(postLogoutRedirectUris) ? postLogoutRedirectUris : postLogoutRedirectUris.split(',').map((s: string) => s.trim()),
      grantTypes: Array.isArray(grantTypes) ? grantTypes : (grantTypes ? grantTypes.split(',').map((s: string) => s.trim()) : ['authorization_code']),
      responseTypes: Array.isArray(responseTypes) ? responseTypes : (responseTypes ? responseTypes.split(',').map((s: string) => s.trim()) : ['code']),
      scope: scope || 'openid profile email',
      logoUri: logoUri || null,
      brandColor: brandColor || null,
    };

    if (id) {
      // Atualiza cliente existente
      await db.update(clients).set(data).where(eq(clients.id, id));
    } else {
      // Cria novo cliente
      await db.insert(clients).values(data);
    }

    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    const result = id ? await db.select().from(clients).where(eq(clients.id, id)).limit(1) : [];
    const client = result[0] || { ...req.body, id: null };
    renderView(res, ClientsForm, {
      client: client || { ...req.body, id: null },
      error: 'Erro ao salvar cliente. Por favor, verifique sua entrada.',
      sidebarLinks: getSidebarLinks('clients'),
    }, { title: id ? 'Edit Client' : 'New Client' });
  }
});

/**
 * POST /admin/clients/:id/delete - Excluir cliente
 */
router.post('/clients/:id/delete', ensureAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(clients).where(eq(clients.id, req.params.id as string));
    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.redirect('/admin/clients');
  }
});

/**
 * GET /admin/clients/generate-secret - Gerar um novo client secret no servidor
 */
router.get('/clients/generate-secret', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const crypto = await import('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    res.json({ secret });
  } catch (error) {
    console.error('Erro ao gerar client secret:', error);
    res.status(500).json({ error: 'Erro ao gerar client secret' });
  }
});

/**
 * GET /admin/users - Lista de usuários
 */
router.get('/users', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));

    renderView(res, UsersList, {
      users: allUsers,
      sidebarLinks: getSidebarLinks('users'),
    }, { 
      title: 'Users',
      componentName: 'UsersList',
      enableHydration: true 
    });
  } catch (error) {
    console.error('Erro na lista de usuários:', error);
    res.status(500).send('Erro ao carregar usuários');
  }
});

/**
 * POST /admin/users/:id/reset-password - Redefinir senha do usuário
 */
router.post('/users/:id/reset-password', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      
      return renderView(res, UsersList, {
        users: allUsers,
        error: 'A senha deve ter pelo menos 6 caracteres',
        sidebarLinks: getSidebarLinks('users'),
      }, { title: 'Users' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, req.params.id as string));

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.redirect('/admin/users');
  }
});

/**
 * POST /admin/users/:id/toggle-role - Alternar função do usuário entre USER e ADMIN
 */
router.post('/users/:id/toggle-role', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.select({ role: users.role }).from(users).where(eq(users.id, req.params.id as string)).limit(1);
    const user = result[0];

    if (!user) {
      return res.redirect('/admin/users');
    }

    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    await db.update(users).set({ role: newRole }).where(eq(users.id, req.params.id as string));

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Erro ao alternar função:', error);
    res.redirect('/admin/users');
  }
});

/**
 * Função auxiliar para gerar links da barra lateral com estado ativo
 */
function getSidebarLinks(active: string) {
  return [
    { href: '/admin', label: 'Dashboard', active: active === 'dashboard' },
    { href: '/admin/clients', label: 'Clients', active: active === 'clients' },
    { href: '/admin/users', label: 'Users', active: active === 'users' },
  ];
}

export default router;
