import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface Client {
  id: string | null;
  clientId: string;
  clientSecret: string;
  name: string | null;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scope: string | null;
  logoUri: string | null;
  brandColor: string | null;
}

interface ClientsFormProps {
  client: Client | null;
  error: string | null;
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const ClientsForm: React.FC<ClientsFormProps> = ({ client, error, sidebarLinks }) => {
  const isEdit = client?.id !== null;
  const title = isEdit ? 'Edit Client' : 'New Client';

  return (
    <Layout variant="admin" title={title} sidebarLinks={sidebarLinks}>
      <Card>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isEdit ? 'Update client configuration' : 'Register a new OAuth 2.0 client application'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form method="POST" action="/admin/clients">
          <input type="hidden" name="id" value={client?.id || ''} />

          <Input
            label="Client ID"
            type="text"
            name="clientId"
            defaultValue={client?.clientId || ''}
            placeholder="my-app-client"
            required
          />

          <Input
            label="Client Secret"
            type="text"
            name="clientSecret"
            defaultValue={client?.clientSecret || ''}
            placeholder="Enter a secure secret"
            required
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Generate Random Secret
            </label>
            <button
              type="button"
              onClick={() => {
                const input = document.querySelector('input[name="clientSecret"]') as HTMLInputElement;
                if (input) {
                  const randomSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                  input.value = randomSecret;
                }
              }}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Generate Secret
            </button>
          </div>

          <Input
            label="Name"
            type="text"
            name="name"
            defaultValue={client?.name || ''}
            placeholder="My Application"
          />

          <div className="mb-4">
            <label htmlFor="redirectUris" className="block text-sm font-medium text-gray-700 mb-1">
              Redirect URIs
            </label>
            <input
              id="redirectUris"
              type="text"
              name="redirectUris"
              defaultValue={client?.redirectUris?.join(', ') || ''}
              placeholder="http://localhost:3000/callback, https://example.com/callback"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated list of allowed redirect URIs</p>
          </div>

          <div className="mb-4">
            <label htmlFor="postLogoutRedirectUris" className="block text-sm font-medium text-gray-700 mb-1">
              Post Logout Redirect URIs
            </label>
            <input
              id="postLogoutRedirectUris"
              type="text"
              name="postLogoutRedirectUris"
              defaultValue={client?.postLogoutRedirectUris?.join(', ') || ''}
              placeholder="http://localhost:3000, https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated list of URIs to redirect after logout</p>
          </div>

          <Input
            label="Scope"
            type="text"
            name="scope"
            defaultValue={client?.scope || 'openid profile email'}
            placeholder="openid profile email"
          />

          <Input
            label="Logo URL"
            type="url"
            name="logoUri"
            defaultValue={client?.logoUri || ''}
            placeholder="https://example.com/logo.png"
          />

          <Input
            label="Brand Color"
            type="color"
            name="brandColor"
            defaultValue={client?.brandColor || '#3b82f6'}
          />

          <div className="flex justify-end space-x-3 mt-6">
            <a href="/admin/clients">
              <Button variant="outline">Cancel</Button>
            </a>
            <Button type="submit">
              {isEdit ? 'Update Client' : 'Create Client'}
            </Button>
          </div>
        </form>
      </Card>
    </Layout>
  );
};
