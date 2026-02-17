import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
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
      header: 'User',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name || 'No name'}</div>
          <div className="text-sm text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
          value === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'emailVerified',
      header: 'Verified',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value ? 'Yes' : 'No'}
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
          <button
            type="button"
            onClick={() => {
              const newPassword = prompt(`Enter new password for ${row.email}:`);
              if (newPassword) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = `/admin/users/${row.id}/reset-password`;
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'newPassword';
                input.value = newPassword;
                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
              }
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Reset Password
          </button>
          <form method="POST" action={`/admin/users/${row.id}/toggle-role`} className="inline">
            <button
              type="submit"
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              {row.role === 'ADMIN' ? 'Make User' : 'Make Admin'}
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <Layout variant="admin" title="Users" sidebarLinks={sidebarLinks}>
      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">View and manage user accounts</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Table
          columns={columns}
          data={users}
          emptyMessage="No users found."
        />
      </Card>
    </Layout>
  );
};
