import { Router, Request, Response } from 'express';
import { prisma } from '../adapter';
import * as bcrypt from 'bcryptjs';
import { ensureAdmin, ensureNotAdmin } from '../middleware/auth';
import { renderView } from '../utils/renderer';
import '../types/express';

// Importa as visualizações de admin
import { Dashboard } from '../views/admin/Dashboard';
import { ClientsList } from '../views/admin/ClientsList';
import { ClientsForm } from '../views/admin/ClientsForm';
import { UsersList } from '../views/admin/UsersList';
import { AdminLogin } from '../views/admin/AdminLogin';

const router = Router();

/**
 * GET /admin/login - Página de login do administrador
 */
router.get('/login', ensureNotAdmin, (req: Request, res: Response) => {
  renderView(res, AdminLogin, { error: null }, { title: 'Admin Login' });
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
    const user = await prisma.user.findUnique({
      where: { email },
    });

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
    const totalUsers = await prisma.user.count();
    const totalClients = await prisma.client.count();
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN' } });

    renderView(res, Dashboard, {
      stats: { totalUsers, totalClients, activeAdmins },
      sidebarLinks: getSidebarLinks('dashboard'),
    }, { title: 'Dashboard' });
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
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    renderView(res, ClientsList, {
      clients,
      sidebarLinks: getSidebarLinks('clients'),
    }, { title: 'Clients' });
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
  }, { title: 'New Client' });
});

/**
 * GET /admin/clients/:id/edit - Formulário de edição de cliente
 */
router.get('/clients/:id/edit', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id as string },
    });

    if (!client) {
      return res.redirect('/admin/clients');
    }

    renderView(res, ClientsForm, {
      client,
      error: null,
      sidebarLinks: getSidebarLinks('clients'),
    }, { title: 'Edit Client' });
  } catch (error) {
    console.error('Erro na edição do cliente:', error);
    res.redirect('/admin/clients');
  }
});

/**
 * POST /admin/clients - Criar ou atualizar cliente
 */
router.post('/clients', ensureAdmin, async (req: Request, res: Response) => {
  const { id, name, clientId, clientSecret, redirectUris, postLogoutRedirectUris, scope, logoUri, brandColor } = req.body;

  try {
    const data = {
      name: name || null,
      clientId,
      clientSecret,
      redirectUris: Array.isArray(redirectUris) ? redirectUris : redirectUris.split(',').map((s: string) => s.trim()),
      postLogoutRedirectUris: Array.isArray(postLogoutRedirectUris) ? postLogoutRedirectUris : postLogoutRedirectUris.split(',').map((s: string) => s.trim()),
      scope: scope || 'openid profile email',
      logoUri: logoUri || null,
      brandColor: brandColor || null,
    };

    if (id) {
      // Atualiza cliente existente
      await prisma.client.update({
        where: { id },
        data,
      });
    } else {
      // Cria novo cliente
      await prisma.client.create({ data });
    }

    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    const client = id ? await prisma.client.findUnique({ where: { id } }) : null;
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
    await prisma.client.delete({
      where: { id: req.params.id as string },
    });
    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.redirect('/admin/clients');
  }
});

/**
 * GET /admin/users - Lista de usuários
 */
router.get('/users', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    renderView(res, UsersList, {
      users,
      sidebarLinks: getSidebarLinks('users'),
    }, { title: 'Users' });
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
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
      });
      return renderView(res, UsersList, {
        users,
        error: 'A senha deve ter pelo menos 6 caracteres',
        sidebarLinks: getSidebarLinks('users'),
      }, { title: 'Users' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { passwordHash },
    });

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
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: { role: true },
    });

    if (!user) {
      return res.redirect('/admin/users');
    }

    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { role: newRole },
    });

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
