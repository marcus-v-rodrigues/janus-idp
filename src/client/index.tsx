import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { hydrateRoot } from 'react-dom/client';

// Interface para os dados de hidratação
interface HydrationData {
  componentName: string;
  props: Record<string, any>;
}

// Função para importar componentes dinamicamente
async function importComponent(componentName: string): Promise<React.FC<any> | null> {
  try {
    switch (componentName) {
      case 'Dashboard':
        const { Dashboard } = await import('../views/admin/Dashboard');
        return Dashboard;
      case 'ClientsList':
        const { ClientsList } = await import('../views/admin/ClientsList');
        return ClientsList;
      case 'ClientsForm':
        const { ClientsForm } = await import('../views/admin/ClientsForm');
        return ClientsForm;
      case 'UsersList':
        const { UsersList } = await import('../views/admin/UsersList');
        return UsersList;
      case 'AdminLogin':
        const { AdminLogin } = await import('../views/admin/AdminLogin');
        return AdminLogin;
      case 'Login':
        const { Login } = await import('../views/oidc/Login');
        return Login;
      case 'Consent':
        const { Consent } = await import('../views/oidc/Consent');
        return Consent;
      case 'Register':
        const { Register } = await import('../views/oidc/Register');
        return Register;
      case 'Error':
        const { Error: ErrorComponent } = await import('../views/oidc/Error');
        return ErrorComponent;
      default:
        console.warn(`Componente não encontrado: ${componentName}`);
        return null;
    }
  } catch (error) {
    console.error(`Erro ao importar componente ${componentName}:`, error);
    return null;
  }
}

// Função principal de hidratação
async function hydrate() {
  // Busca os dados de hidratação do script global
  const hydrationElement = document.getElementById('__HYDRATION_DATA__');
  
  if (!hydrationElement) {
    console.warn('Dados de hidratação não encontrados. Nenhuma hidratação será realizada.');
    return;
  }

  try {
    const hydrationData: HydrationData = JSON.parse(hydrationElement.textContent || '{}');
    const { componentName, props } = hydrationData;

    if (!componentName) {
      console.warn('Nome do componente não encontrado nos dados de hidratação.');
      return;
    }

    const Component = await importComponent(componentName);

    if (!Component) {
      console.error(`Não foi possível carregar o componente: ${componentName}`);
      return;
    }

    // Encontra o elemento root onde o componente foi renderizado no servidor
    const rootElement = document.getElementById('root');

    if (!rootElement) {
      console.error('Elemento root não encontrado no DOM.');
      return;
    }

    // Realiza a hidratação
    hydrateRoot(
      rootElement,
      React.createElement(Component, props)
    );

    console.log(`✅ Componente "${componentName}" hidratado com sucesso!`);
  } catch (error) {
    console.error('Erro durante a hidratação:', error);
  }
}

// Inicia a hidratação quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrate);
} else {
  hydrate();
}
