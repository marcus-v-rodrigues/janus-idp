import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface AdminLoginProps {
  error: string | null;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ error }) => {
  return (
    <Layout variant="admin">
      <Card>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to access the admin dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form method="POST" action="/admin/login">
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="admin@example.com"
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

          <Button type="submit" fullWidth>
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-500">
            ← Back to home
          </a>
        </div>
      </Card>
    </Layout>
  );
};
