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
  grantTypes: string[];
  responseTypes: string[];
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
  const [clientSecret, setClientSecret] = React.useState(client?.clientSecret || '');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [brandColor, setBrandColor] = React.useState(client?.brandColor || '#3b82f6');

  // Sincroniza o estado com alterações de prop (importante para hydratation)
  React.useEffect(() => {
    if (client?.clientSecret) {
      setClientSecret(client.clientSecret);
    }
  }, [client?.clientSecret]);

  React.useEffect(() => {
    if (client?.brandColor) {
      setBrandColor(client.brandColor);
    }
  }, [client?.brandColor]);

  const handleGenerateSecret = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/admin/clients/generate-secret');
      if (!response.ok) {
        throw new Error('Failed to generate secret');
      }
      const data = await response.json();
      if (data.secret) {
        setClientSecret(data.secret);
      }
    } catch (error) {
      console.error('Error generating secret:', error);
      alert('Failed to generate client secret. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

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

          <div className="mb-4">
            <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <div className="flex gap-2">
              <input
                id="clientSecret"
                type="text"
                name="clientSecret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter a secure secret"
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleGenerateSecret}
                disabled={isGenerating}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md transition-colors"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
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

          <div className="mb-4">
            <label htmlFor="grantTypes" className="block text-sm font-medium text-gray-700 mb-1">
              Grant Types
            </label>
            <input
              id="grantTypes"
              type="text"
              name="grantTypes"
              defaultValue={client?.grantTypes?.join(', ') || 'authorization_code'}
              placeholder="authorization_code"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated list of grant types (e.g., authorization_code, client_credentials)</p>
          </div>

          <div className="mb-4">
            <label htmlFor="responseTypes" className="block text-sm font-medium text-gray-700 mb-1">
              Response Types
            </label>
            <input
              id="responseTypes"
              type="text"
              name="responseTypes"
              defaultValue={client?.responseTypes?.join(', ') || 'code'}
              placeholder="code"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated list of response types (e.g., code, id_token, token)</p>
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

          <div className="mb-4">
            <label htmlFor="brandColor" className="block text-sm font-medium text-gray-700 mb-1">
              Brand Color
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="brandColor"
                type="color"
                name="brandColor"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-16 h-10 border border-gray-300 rounded-md cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                placeholder="#3B82F6"
              />
              <div
                className="w-16 h-10 rounded-md border border-gray-300 shadow-sm"
                style={{ backgroundColor: brandColor }}
                title="Color preview"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Select a color for brand customization</p>
          </div>

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
