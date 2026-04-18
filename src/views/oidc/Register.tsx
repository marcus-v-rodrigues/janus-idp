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

interface RegisterProps {
  uid: string;
  client: Client;
  params: any;
  flash?: string;
  success?: string;
}

export const Register: React.FC<RegisterProps> = ({ uid, client, params, flash, success }) => {
  const brandColor = client.brandColor || '#3b82f6';
  const clientName = client.name || client.clientId;

  return (
    <Layout variant="auth">
      <Card>
        {/* Logo do cliente */}
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
          <h1 className="text-2xl font-bold text-gray-900">Criar Conta</h1>
          <p className="mt-2 text-sm text-gray-600">
            para continuar em <span className="font-medium">{clientName}</span>
          </p>
        </div>

        {flash && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{flash}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
            <div className="mt-2">
              <a 
                href={`/oidc/interaction/${uid}`} 
                className="text-sm font-medium text-green-700 hover:text-green-800 underline"
              >
                Ir para o Login
              </a>
            </div>
          </div>
        )}

        {!success && (
          <form method="POST" action={`/oidc/interaction/${uid}/register`}>
            <Input
              label="Nome Completo"
              type="text"
              name="name"
              placeholder="Seu nome"
              required
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="voce@exemplo.com"
              required
              autoComplete="email"
            />

            <Input
              label="Senha"
              type="password"
              name="password"
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              minLength={6}
            />

            <Button
              type="submit"
              fullWidth
              style={{ backgroundColor: brandColor }}
              className="hover:opacity-90 mt-4"
            >
              Registrar
            </Button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Já tem uma conta?{' '}
                <a 
                  href={`/oidc/interaction/${uid}`} 
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Fazer Login
                </a>
              </p>
            </div>
          </form>
        )}

        <div className="mt-6 text-center border-t pt-4">
          <p className="text-xs text-gray-500">
            Ao criar uma conta, você concorda com os{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Termos de Serviço
            </a>{' '}
            e a{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Política de Privacidade
            </a>
          </p>
        </div>
      </Card>
    </Layout>
  );
};
