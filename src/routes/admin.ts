import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../adapter';
import { schema } from '../db';
import {
  DEFAULT_CLIENT_ROLE_CODE,
  JANUS_ADMIN_ROLE_CODE,
  assignRoleToAllUsers,
  assignRoleToUsers,
  deleteRole,
  ensureClientDefaultRole,
  ensureGlobalRole,
  ensureRoleExists,
  ensureUserRole,
  getDefaultGlobalRoles,
  getRoleAssignmentCount,
  getRoleById,
  getRoleByScopeAndCode,
  getUserRoleAssignments,
  listAssignableRoles,
  listRoles,
  listUsersWithRoles,
  removeUserRole,
  updateRole,
  userHasAnyGlobalRole,
} from '../services/rbac';
import { ensureAdmin, ensureNotAdmin } from '../middleware/auth';
import { renderView } from '../utils/renderer';
import { Dashboard } from '../views/admin/Dashboard';
import { ClientsList } from '../views/admin/ClientsList';
import { ClientsForm } from '../views/admin/ClientsForm';
import { UsersList } from '../views/admin/UsersList';
import { AdminLogin } from '../views/admin/AdminLogin';
import { RolesList } from '../views/admin/RolesList';
import { RoleForm } from '../views/admin/RoleForm';
import { UserRoles } from '../views/admin/UserRoles';

const router = Router();

const { users, clients, roles, userRoleAssignments } = schema;

function getSidebarLinks(active: string) {
  return [
    { href: '/admin', label: 'Painel', active: active === 'dashboard' },
    { href: '/admin/clients', label: 'Clientes', active: active === 'clients' },
    { href: '/admin/users', label: 'Usuários', active: active === 'users' },
    { href: '/admin/roles', label: 'Papéis', active: active === 'roles' },
  ];
}

router.get('/login', ensureNotAdmin, (_req: Request, res: Response) => {
  renderView(res, AdminLogin, { error: null }, {
    title: 'Login administrativo',
    componentName: 'AdminLogin',
    enableHydration: true,
  });
});

router.post('/login', ensureNotAdmin, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return renderView(res, AdminLogin, { error: 'Informe email e senha.' }, { title: 'Login administrativo' });
  }

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user) {
      return renderView(res, AdminLogin, { error: 'Credenciais inválidas.' }, { title: 'Login administrativo' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return renderView(res, AdminLogin, { error: 'Credenciais inválidas.' }, { title: 'Login administrativo' });
    }

    const isJanusAdmin = await userHasAnyGlobalRole(user.id, [JANUS_ADMIN_ROLE_CODE]);
    if (!isJanusAdmin) {
      return renderView(res, AdminLogin, { error: 'Acesso negado. É necessário o papel janus_admin.' }, { title: 'Login administrativo' });
    }

    req.session!.adminUserSub = user.sub;
    res.redirect('/admin');
  } catch (error) {
    console.error('Erro no login administrativo:', error);
    renderView(res, AdminLogin, { error: 'Ocorreu um erro. Tente novamente.' }, { title: 'Login administrativo' });
  }
});

router.get('/logout', (req: Request, res: Response) => {
  delete req.session?.adminUserSub;
  res.redirect('/admin/login');
});

router.get('/', ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [totalClientsResult] = await db.select({ count: count() }).from(clients);
    const [totalRolesResult] = await db.select({ count: count() }).from(roles);
    const [janusAdminsResult] = await db.select({ count: count() }).from(userRoleAssignments)
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .where(and(eq(roles.scopeType, 'GLOBAL'), eq(roles.code, JANUS_ADMIN_ROLE_CODE)));

    renderView(res, Dashboard, {
      stats: {
        totalUsers: totalUsersResult.count,
        totalClients: totalClientsResult.count,
        totalRoles: totalRolesResult.count,
        janusAdmins: janusAdminsResult.count,
      },
      sidebarLinks: getSidebarLinks('dashboard'),
    }, {
      title: 'Painel',
      componentName: 'Dashboard',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro no painel administrativo:', error);
    res.status(500).send('Erro ao carregar painel');
  }
});

router.get('/clients', ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));

    renderView(res, ClientsList, {
      clients: allClients,
      sidebarLinks: getSidebarLinks('clients'),
    }, {
      title: 'Clientes',
      componentName: 'ClientsList',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro na lista de clientes:', error);
    res.status(500).send('Erro ao carregar clientes');
  }
});

router.get('/clients/new', ensureAdmin, (_req: Request, res: Response) => {
  renderView(res, ClientsForm, {
    client: null,
    error: null,
    sidebarLinks: getSidebarLinks('clients'),
  }, {
    title: 'Novo cliente',
    componentName: 'ClientsForm',
    enableHydration: true,
  });
});

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
      title: 'Editar cliente',
      componentName: 'ClientsForm',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro na edição do cliente:', error);
    res.redirect('/admin/clients');
  }
});

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
      await db.update(clients).set(data).where(eq(clients.id, id));
    } else {
      await db.insert(clients).values(data);
      await ensureClientDefaultRole(clientId, 'Usuário', DEFAULT_CLIENT_ROLE_CODE);
    }

    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    const result = id ? await db.select().from(clients).where(eq(clients.id, id)).limit(1) : [];
    const client = result[0] || { ...req.body, id: null };
    renderView(res, ClientsForm, {
      client: client || { ...req.body, id: null },
      error: 'Erro ao salvar cliente. Verifique os dados informados.',
      sidebarLinks: getSidebarLinks('clients'),
    }, { title: id ? 'Editar cliente' : 'Novo cliente' });
  }
});

router.post('/clients/:id/delete', ensureAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(clients).where(eq(clients.id, req.params.id as string));
    res.redirect('/admin/clients');
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.redirect('/admin/clients');
  }
});

router.get('/clients/generate-secret', ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const cryptoModule = await import('crypto');
    const secret = cryptoModule.randomBytes(32).toString('hex');
    res.json({ secret });
  } catch (error) {
    console.error('Erro ao gerar segredo do cliente:', error);
    res.status(500).json({ error: 'Erro ao gerar client secret' });
  }
});

router.get('/users', ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const allUsers = await listUsersWithRoles();

    renderView(res, UsersList, {
      users: allUsers,
      sidebarLinks: getSidebarLinks('users'),
    }, {
      title: 'Usuários',
      componentName: 'UsersList',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro na lista de usuários:', error);
    res.status(500).send('Erro ao carregar usuários');
  }
});

router.get('/users/:id/roles', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const userResult = await db.select().from(users).where(eq(users.id, req.params.id as string)).limit(1);
    const user = userResult[0];
    if (!user) {
      return res.redirect('/admin/users');
    }

    const assignments = await getUserRoleAssignments(user.id);
    const availableRoles = await listAssignableRoles();

    renderView(res, UserRoles, {
      user: {
        id: user.id,
        sub: user.sub,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      assignments,
      availableRoles,
      sidebarLinks: getSidebarLinks('users'),
    }, {
      title: 'Papéis do usuário',
      componentName: 'UserRoles',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro ao carregar papéis do usuário:', error);
    res.redirect('/admin/users');
  }
});

router.post('/users/:id/roles/assign', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { roleId } = req.body;
    if (!roleId) {
      return res.redirect(`/admin/users/${userId}/roles`);
    }

    await ensureUserRole(userId, roleId, req.adminUser?.id ?? null);
    res.redirect(`/admin/users/${userId}/roles`);
  } catch (error) {
    console.error('Erro ao atribuir papel ao usuário:', error);
    res.redirect(`/admin/users/${req.params.id as string}/roles`);
  }
});

router.post('/users/:id/roles/:roleId/remove', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const roleId = req.params.roleId as string;
    await removeUserRole(userId, roleId);
    res.redirect(`/admin/users/${userId}/roles`);
  } catch (error) {
    console.error('Erro ao remover papel do usuário:', error);
    res.redirect(`/admin/users/${req.params.id as string}/roles`);
  }
});

router.get('/roles', ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const allRoles = await listRoles();

    renderView(res, RolesList, {
      roles: allRoles,
      sidebarLinks: getSidebarLinks('roles'),
    }, {
      title: 'Papéis',
      componentName: 'RolesList',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro na lista de papéis:', error);
    res.status(500).send('Erro ao carregar papéis');
  }
});

router.get('/roles/new', ensureAdmin, async (_req: Request, res: Response) => {
  renderView(res, RoleForm, {
    role: null,
    clients: await db.select({ clientId: clients.clientId, name: clients.name }).from(clients).orderBy(desc(clients.createdAt)),
    error: null,
    sidebarLinks: getSidebarLinks('roles'),
  }, {
    title: 'Novo papel',
    componentName: 'RoleForm',
    enableHydration: true,
  });
});

router.post('/roles', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { name, code, scopeType, clientId, description, isSystem } = req.body;
    const role = await ensureRoleExists({
      name,
      code,
      scopeType,
      clientId: scopeType === 'CLIENT' ? clientId : null,
      description: description || null,
      isSystem: isSystem === 'on' || isSystem === true || isSystem === 'true',
    });

    if (!role) {
      throw new Error('Falha ao criar papel');
    }

    res.redirect('/admin/roles');
  } catch (error) {
    console.error('Erro ao criar papel:', error);
    const clientsList = await db.select({ clientId: clients.clientId, name: clients.name }).from(clients).orderBy(desc(clients.createdAt));
    renderView(res, RoleForm, {
      role: null,
      clients: clientsList,
      error: 'Erro ao salvar papel. Verifique os dados informados.',
      sidebarLinks: getSidebarLinks('roles'),
    }, { title: 'Novo papel' });
  }
});

router.get('/roles/:id/edit', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const role = await getRoleById(req.params.id as string);
    if (!role) {
      return res.redirect('/admin/roles');
    }

    const clientsList = await db.select({ clientId: clients.clientId, name: clients.name }).from(clients).orderBy(desc(clients.createdAt));

    renderView(res, RoleForm, {
      role,
      clients: clientsList,
      error: null,
      sidebarLinks: getSidebarLinks('roles'),
    }, {
      title: 'Editar papel',
      componentName: 'RoleForm',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro ao abrir edição do papel:', error);
    res.redirect('/admin/roles');
  }
});

router.post('/roles/:id/edit', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    await updateRole(req.params.id as string, { name, description: description || null });
    res.redirect('/admin/roles');
  } catch (error) {
    console.error('Erro ao atualizar papel:', error);
    res.redirect(`/admin/roles/${req.params.id}/edit`);
  }
});

router.post('/roles/:id/delete', ensureAdmin, async (req: Request, res: Response) => {
  try {
    await deleteRole(req.params.id as string);
    res.redirect('/admin/roles');
  } catch (error) {
    console.error('Erro ao excluir papel:', error);
    res.redirect('/admin/roles');
  }
});

router.get('/roles/:id/assign', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const role = await getRoleById(req.params.id as string);
    if (!role) {
      return res.redirect('/admin/roles');
    }

    const usersList = await listUsersWithRoles();
    const assignmentCount = await getRoleAssignmentCount(role.id);

    renderView(res, UserRoles, {
      user: null,
      assignments: [],
      availableRoles: [],
      role,
      roleAssignmentCount: assignmentCount,
      users: usersList,
      sidebarLinks: getSidebarLinks('roles'),
    }, {
      title: 'Atribuir papel',
      componentName: 'UserRoles',
      enableHydration: true,
    });
  } catch (error) {
    console.error('Erro ao abrir atribuição do papel:', error);
    res.redirect('/admin/roles');
  }
});

router.post('/roles/:id/assign', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const role = await getRoleById(req.params.id as string);
    if (!role) {
      return res.redirect('/admin/roles');
    }

    const target = req.body.target;
    const selectedUserIds = Array.isArray(req.body.userIds) ? req.body.userIds : req.body.userIds ? [req.body.userIds] : [];

    if (target === 'all') {
      await assignRoleToAllUsers({ roleId: role.id, assignedByUserId: req.adminUser?.id ?? null });
    } else {
      await assignRoleToUsers({
        roleId: role.id,
        userIds: selectedUserIds,
        assignedByUserId: req.adminUser?.id ?? null,
      });
    }

    res.redirect(`/admin/roles/${role.id}/assign`);
  } catch (error) {
    console.error('Erro ao atribuir papel em massa:', error);
    res.redirect(`/admin/roles/${req.params.id}/assign`);
  }
});

export default router;
