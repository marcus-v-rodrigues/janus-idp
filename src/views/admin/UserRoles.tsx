import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface UserSummary {
  id: string;
  sub: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

interface Assignment {
  assignmentId: string;
  roleId: string;
  roleName: string;
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  scopeKey: string;
  clientId: string | null;
  description: string | null;
  isSystem: boolean;
  assignedByUserId: string | null;
  createdAt: Date;
}

interface RoleSummary {
  id: string;
  name: string;
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  clientId: string | null;
  description: string | null;
  isSystem: boolean;
}

interface UserRoleEntry {
  id: string;
  sub: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  roles: Array<{ id: string }>;
}

interface UserRolesProps {
  user?: UserSummary | null;
  assignments?: Assignment[];
  availableRoles?: RoleSummary[];
  role?: RoleSummary | null;
  roleAssignmentCount?: number;
  users?: UserRoleEntry[];
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const UserRoles: React.FC<UserRolesProps> = ({
  user = null,
  assignments = [],
  availableRoles = [],
  role = null,
  roleAssignmentCount = 0,
  users = [],
  sidebarLinks,
}) => {
  if (user) {
    const assignedRoleIds = new Set(assignments.map((assignment) => assignment.roleId));
    const selectableRoles = availableRoles.filter((item) => !assignedRoleIds.has(item.id));

    return (
      <Layout variant="admin" title="Papéis do usuário" sidebarLinks={sidebarLinks}>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{user.name || user.email}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-gray-400">sub: {user.sub}</p>
            </div>

            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.assignmentId} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <div className="font-medium text-gray-900">{assignment.roleName}</div>
                    <div className="text-sm text-gray-500">
                      {assignment.scopeType === 'GLOBAL' ? 'Global' : `Cliente: ${assignment.clientId}`}
                    </div>
                    <div className="text-xs text-gray-400">{assignment.code}</div>
                  </div>
                  <form method="POST" action={`/admin/users/${user.id}/roles/${assignment.roleId}/remove`}>
                    <Button type="submit" variant="outline">Remover</Button>
                  </form>
                </div>
              ))}

              {assignments.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum papel atribuído.</p>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar papel</h3>
            <form method="POST" action={`/admin/users/${user.id}/roles`}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="roleId">
                  Papel disponível
                </label>
                <select
                  id="roleId"
                  name="roleId"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione um papel</option>
                  {selectableRoles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" fullWidth>
                Atribuir papel
              </Button>
            </form>
          </Card>
        </div>
      </Layout>
    );
  }

  if (role) {
    const selectedUserIds = new Set(
      users.filter((item) => item.roles.some((assigned) => assigned.id === role.id)).map((item) => item.id)
    );

    return (
      <Layout variant="admin" title="Atribuir papel" sidebarLinks={sidebarLinks}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6">
          <Card>
            <h2 className="text-xl font-semibold text-gray-900">{role.name}</h2>
            <p className="text-sm text-gray-500">{role.code}</p>
            <p className="text-sm text-gray-500 mt-2">
              {role.scopeType === 'GLOBAL' ? 'Papel global' : `Papel do cliente ${role.clientId}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">Atribuições atuais: {roleAssignmentCount}</p>
          </Card>

          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Atribuir em massa</h3>
            <form method="POST" action={`/admin/roles/${role.id}/assign`}>
              <div className="mb-4 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="target" value="selected" defaultChecked className="h-4 w-4" />
                  <span className="text-sm text-gray-700">Selecionados</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="target" value="all" className="h-4 w-4" />
                  <span className="text-sm text-gray-700">Todos os usuários</span>
                </label>
              </div>

              <div className="max-h-[32rem] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Selecionar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Usuário</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">sub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {users.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            name="userIds"
                            value={item.id}
                            defaultChecked={selectedUserIds.has(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.name || item.email}</div>
                          <div className="text-sm text-gray-500">{item.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.sub}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <Button type="submit" fullWidth>
                  Salvar atribuições
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout variant="admin" title="Papéis do usuário" sidebarLinks={sidebarLinks}>
      <Card>
        <p className="text-sm text-gray-500">Nenhum contexto de usuário ou papel foi informado.</p>
      </Card>
    </Layout>
  );
};
