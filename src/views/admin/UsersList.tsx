import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';

interface UserRole {
  id: string;
  name: string;
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  clientId: string | null;
  scopeKey: string;
  isSystem: boolean;
}

interface User {
  id: string;
  sub: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
  roles: UserRole[];
}

interface UsersListProps {
  users: User[];
  error?: string;
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const UsersList: React.FC<UsersListProps> = ({ users, error, sidebarLinks }) => {
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Usuário',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name || 'Sem nome'}</div>
          <div className="text-sm text-gray-500">{row.email}</div>
          <div className="text-xs text-gray-400">sub: {row.sub}</div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Papéis',
      render: (value) => (
        <div className="flex flex-wrap gap-2">
          {(value as UserRole[]).map((role) => (
            <span
              key={role.id}
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                role.scopeType === 'GLOBAL'
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {role.code}
            </span>
          ))}
          {(value as UserRole[]).length === 0 && (
            <span className="text-sm text-gray-400">Sem papéis</span>
          )}
        </div>
      ),
    },
    {
      key: 'emailVerified',
      header: 'Verificado',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value ? 'Sim' : 'Não'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (value) => {
        const date = new Date(value);
        return (
          <span className="text-sm text-gray-600">
            {date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (_, row) => (
        <div className="flex space-x-2">
          <a
            href={`/admin/users/${row.id}/roles`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Gerenciar papéis
          </a>
        </div>
      ),
    },
  ];

  return (
    <Layout variant="admin" title="Usuários" sidebarLinks={sidebarLinks}>
      <Card>
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Gerenciamento de usuários</h2>
              <p className="text-sm text-gray-500">Cada usuário é identificado pelo sub e acessa clientes por papéis.</p>
            </div>
            <a href="/admin/roles/new">
              <Button>Criar papel</Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Table
          columns={columns}
          data={users}
          emptyMessage="Nenhum usuário encontrado."
        />
      </Card>
    </Layout>
  );
};
