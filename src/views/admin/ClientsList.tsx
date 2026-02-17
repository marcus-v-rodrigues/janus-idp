import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';

interface Client {
  id: string;
  clientId: string;
  name: string | null;
  redirectUris: string[];
  scope: string | null;
  createdAt: Date;
}

interface ClientsListProps {
  clients: Client[];
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const ClientsList: React.FC<ClientsListProps> = ({ clients, sidebarLinks }) => {
  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value || row.clientId}</div>
          <div className="text-sm text-gray-500">{row.clientId}</div>
        </div>
      ),
    },
    {
      key: 'redirectUris',
      header: 'Redirect URIs',
      render: (value) => (
        <div className="max-w-xs truncate text-sm text-gray-600">
          {Array.isArray(value) ? value.join(', ') : value}
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (value) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
          {value || 'openid profile email'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (value) => (
        <span className="text-sm text-gray-600">
          {new Date(value).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex space-x-2">
          <a
            href={`/admin/clients/${row.id}/edit`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Edit
          </a>
          <form method="POST" action={`/admin/clients/${row.id}/delete`} className="inline">
            <button
              type="submit"
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Delete
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <Layout variant="admin" title="Clients" sidebarLinks={sidebarLinks}>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">OAuth Clients</h2>
            <p className="text-sm text-gray-500">Manage your OIDC client applications</p>
          </div>
          <a href="/admin/clients/new">
            <Button>New Client</Button>
          </a>
        </div>

        <Table
          columns={columns}
          data={clients}
          emptyMessage="No clients found. Create your first client to get started."
        />
      </Card>
    </Layout>
  );
};
