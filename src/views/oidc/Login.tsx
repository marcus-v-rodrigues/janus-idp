import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface Client {
  clientId: string;
  name: string | null;
  logoUri: string | null;
  brandColor: string | null;
}

interface LoginProps {
  uid: string;
  client: Client;
  params: any;
  flash?: string;
}

export const Login: React.FC<LoginProps> = ({ uid, client, params, flash }) => {
  const brandColor = client.brandColor || '#3b82f6';
  const clientName = client.name || client.clientId;

  return (
    <Layout variant="auth">
      <Card>
        {/* Client Logo */}
        {client.logoUri && (
          <div className="flex justify-center mb-6">
            <img
              src={client.logoUri}
              alt={`${clientName} logo`}
              className="h-12 w-auto"
            />
          </div>
        )}

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-2 text-sm text-gray-600">
            to continue to <span className="font-medium">{clientName}</span>
          </p>
        </div>

        {flash && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{flash}</p>
          </div>
        )}

        {/* O path deve ser /oidc/interaction/... para compartilhar cookies com o OIDC Provider */}
        <form method="POST" action={`/oidc/interaction/${uid}/login`}>
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <div className="flex items-center mb-4">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            fullWidth
            style={{ backgroundColor: brandColor }}
            className="hover:opacity-90"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to the{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </Card>
    </Layout>
  );
};
