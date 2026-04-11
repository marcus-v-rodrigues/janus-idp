import * as React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface Role {
  id: string;
  name: string;
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  scopeKey: string;
  clientId: string | null;
  description: string | null;
  isSystem: boolean;
}

interface ClientOption {
  clientId: string;
  name: string | null;
}

interface RoleFormProps {
  role: Role | null;
  clients: ClientOption[];
  error: string | null;
  sidebarLinks: Array<{ href: string; label: string; active?: boolean }>;
}

export const RoleForm: React.FC<RoleFormProps> = ({ role, clients, error, sidebarLinks }) => {
  const isEdit = Boolean(role);
  const currentRole = role as Role | null;
  const [scopeType, setScopeType] = React.useState<Role['scopeType']>(role?.scopeType || 'GLOBAL');

  React.useEffect(() => {
    if (role?.scopeType) {
      setScopeType(role.scopeType);
    }
  }, [role?.scopeType]);

  return (
    <Layout variant="admin" title={isEdit ? 'Editar papel' : 'Novo papel'} sidebarLinks={sidebarLinks}>
      <Card>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Editar papel' : 'Criar papel'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isEdit
              ? 'Atualize nome e descrição do papel.'
              : 'Crie um papel global ou um papel vinculado a um cliente.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form method="POST" action={isEdit ? `/admin/roles/${currentRole?.id}/edit` : '/admin/roles'}>
          <Input
            label="Nome"
            type="text"
            name="name"
            defaultValue={role?.name || ''}
            placeholder="Papel de leitura"
            required
          />

          {isEdit ? (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700"><span className="font-medium">Código:</span> {currentRole?.code}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Escopo:</span> {currentRole?.scopeType === 'GLOBAL' ? 'Global' : `Cliente (${currentRole?.clientId})`}</p>
              <p className="text-xs text-gray-500 mt-1">O código e o escopo são fixos após a criação.</p>
            </div>
          ) : (
            <>
              <Input
                label="Código"
                type="text"
                name="code"
                defaultValue={role?.code || ''}
                placeholder="viewer"
                required
              />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="scopeType">
                  Escopo
                </label>
                <select
                  id="scopeType"
                  name="scopeType"
                  value={scopeType}
                  onChange={(event) => setScopeType(event.target.value as Role['scopeType'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="GLOBAL">Global</option>
                  <option value="CLIENT">Cliente</option>
                </select>
              </div>

              {scopeType === 'CLIENT' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="clientId">
                    Cliente
                  </label>
                  <select
                    id="clientId"
                    name="clientId"
                    defaultValue={role?.clientId || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={scopeType === 'CLIENT'}
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => (
                      <option key={client.clientId} value={client.clientId}>
                        {client.name || client.clientId}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <Input
            label="Descrição"
            type="text"
            name="description"
            defaultValue={role?.description || ''}
            placeholder="Descrição opcional"
          />

          {!isEdit && (
            <div className="flex items-center gap-2 mb-6">
              <input
                id="isSystem"
                type="checkbox"
                name="isSystem"
                defaultChecked={false}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isSystem" className="text-sm text-gray-700">
                Marcar como papel de sistema
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit">{isEdit ? 'Salvar alterações' : 'Criar papel'}</Button>
            <a href="/admin/roles" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
              Cancelar
            </a>
          </div>
        </form>
      </Card>
    </Layout>
  );
};
