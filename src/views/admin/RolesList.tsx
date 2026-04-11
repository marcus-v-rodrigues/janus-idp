import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';

interface Role {
  id: string;
  name: string;
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  scopeKey: string;
  clientId: string | null;
  clientName: string | null;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
}

interface RolesListProps {
  roles: Role[];
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const RolesList: React.FC<RolesListProps> = ({ roles, sidebarLinks }) => {
  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Papel',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-500">{row.code}</div>
          <div className="text-xs text-gray-400">{row.description || 'Sem descrição'}</div>
        </div>
      ),
    },
    {
      key: 'scopeType',
      header: 'Escopo',
      render: (value, row) => (
        <div className="space-y-1">
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
            value === 'GLOBAL' ? 'bg-slate-100 text-slate-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {value === 'GLOBAL' ? 'Global' : 'Cliente'}
          </span>
          <div className="text-xs text-gray-500">
            {row.clientId ? `${row.clientName || row.clientId}` : 'Disponível em toda a plataforma'}
          </div>
        </div>
      ),
    },
    {
      key: 'isSystem',
      header: 'Sistema',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
          value ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
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
        <div className="flex flex-wrap gap-3">
          <a
            href={`/admin/roles/${row.id}/edit`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Editar
          </a>
          <a
            href={`/admin/roles/${row.id}/assign`}
            className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
          >
            Atribuir
          </a>
          <form method="POST" action={`/admin/roles/${row.id}/delete`} className="inline">
            <button
              type="submit"
              className="text-red-600 hover:text-red-800 text-sm font-medium"
              disabled={row.isSystem}
            >
              {row.isSystem ? 'Protegido' : 'Excluir'}
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <Layout variant="admin" title="Papéis" sidebarLinks={sidebarLinks}>
      <Card>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Catálogo de papéis</h2>
            <p className="text-sm text-gray-500">Papéis globais e por cliente, criados diretamente no banco.</p>
          </div>
          <a href="/admin/roles/new">
            <Button>Novo papel</Button>
          </a>
        </div>

        <Table
          columns={columns}
          data={roles}
          emptyMessage="Nenhum papel cadastrado."
        />
      </Card>
    </Layout>
  );
};
