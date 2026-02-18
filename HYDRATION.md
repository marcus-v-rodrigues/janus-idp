# Implementação de Client-Side Hydration

## Visão Geral

Este projeto agora suporta hidratação client-side para componentes React, permitindo o melhor dos dois mundos: renderização server-side para SEO e performance de carregamento inicial, além de interatividade client-side.

## O que é Hydration?

Hydration é o processo onde o React "assume o controle" de uma página HTML renderizada no servidor e a torna interativa. O servidor renderiza o HTML inicial, e então o JavaScript client-side anexa event listeners e habilita a interatividade.

## Arquitetura

### Server-Side (SSR)
- Componentes são renderizados usando `ReactDOMServer.renderToString()`
- HTML é gerado com atributos de dados do React
- Props são serializadas e incorporadas na página

### Client-Side (Hydration)
- Vite faz o bundling do código React e dependências
- O script client-side lê os dados de hidratação do DOM
- React hidrata o HTML existente, preservando o conteúdo renderizado no servidor

## Detalhes da Implementação

### 1. Configuração do Vite

O projeto usa Vite para bundling client-side:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.tsx'),
      },
      output: {
        entryFileNames: 'client.js',
        chunkFileNames: 'client-[name].js',
        assetFileNames: 'client-[name].[ext]',
      },
    },
  },
});
```

### 2. Entry Point Client-Side

O entry point client-side ([`src/client/index.tsx`](src/client/index.tsx:1)):

```typescript
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { hydrateRoot } from 'react-dom/client';

// Lê dados de hidratação do DOM
const hydrationElement = document.getElementById('__HYDRATION_DATA__');
const hydrationData = JSON.parse(hydrationElement.textContent);

// Importa o componente dinamicamente
const Component = await importComponent(hydrationData.componentName);

// Hidrata o componente
hydrateRoot(
  document.getElementById('root'),
  React.createElement(Component, hydrationData.props)
);
```

### 3. Renderer Atualizado

A função [`renderView`](src/utils/renderer.tsx:20) agora suporta hidratação:

```typescript
export function renderView<T extends Record<string, any>>(
  res: Response,
  Component: React.FC<T>,
  props: T,
  options: RenderViewOptions = {}
): void {
  const { 
    componentName = '',
    enableHydration = false
  } = options;

  // Usa renderToString para hidratação, renderToStaticMarkup para estático
  const componentHtml = enableHydration
    ? ReactDOMServer.renderToString(React.createElement(Component, props))
    : ReactDOMServer.renderToStaticMarkup(React.createElement(Component, props));

  // Incorpora dados de hidratação
  const hydrationScript = enableHydration && componentName
    ? `<script id="__HYDRATION_DATA__" type="application/json">${JSON.stringify({ componentName, props })}</script>`
    : '';

  // Inclui script client-side
  const clientScript = enableHydration
    ? `<script src="/dist/client.js"></script>`
    : '';
}
```

### 4. Atualização de Rotas

Rotas agora incluem opções de hidratação:

```typescript
router.get('/admin', ensureAdmin, async (req: Request, res: Response) => {
  renderView(res, Dashboard, {
    stats: { totalUsers, totalClients, activeAdmins },
    sidebarLinks: getSidebarLinks('dashboard'),
  }, { 
    title: 'Dashboard',
    componentName: 'Dashboard',
    enableHydration: true 
  });
});
```

## Benefícios

### Performance
- **Carregamento Inicial Mais Rápido**: HTML renderizado no servidor é exibido imediatamente
- **Aprimoramento Progressivo**: A página funciona mesmo antes do JavaScript carregar
- **Code Splitting**: Componentes são carregados sob demanda

### SEO
- **Amigável para Motores de Busca**: Conteúdo está disponível no HTML inicial
- **Melhor Rastreabilidade**: Motores de busca podem indexar conteúdo sem executar JavaScript

### Experiência do Desenvolvedor
- **Type Safety**: Suporte completo TypeScript
- **Hot Module Replacement**: Vite proporciona experiência de desenvolvimento rápida
- **Reutilização de Componentes**: Mesmos componentes funcionam no servidor e cliente

## Uso

### Build do Bundle Client-Side

```bash
# Build apenas do código client-side
npm run build:client

# Build de servidor e cliente
npm run build

# Modo watch para desenvolvimento
npm run dev:client
```

### Habilitando Hydration para uma Rota

Para habilitar hidratação para uma rota, adicione estas opções ao [`renderView`](src/utils/renderer.tsx:20):

```typescript
renderView(res, Component, props, {
  title: 'Page Title',
  componentName: 'ComponentName',  // Deve corresponder ao import em src/client/index.tsx
  enableHydration: true
});
```

### Adicionando Novos Componentes

1. Crie o componente em `src/views/`
2. Adicione ao mapeamento de imports em [`src/client/index.tsx`](src/client/index.tsx:16):

```typescript
case 'MyComponent':
  const { MyComponent } = await import('../views/MyComponent');
  return MyComponent;
```

3. Use em uma rota com hidratação habilitada

## Componentes Suportados

Atualmente, os seguintes componentes suportam hidratação:

### Páginas Admin
- [`Dashboard`](src/views/admin/Dashboard.tsx:14)
- [`ClientsList`](src/views/admin/ClientsList.tsx:1)
- [`ClientsForm`](src/views/admin/ClientsForm.tsx:1)
- [`UsersList`](src/views/admin/UsersList.tsx:1)
- [`AdminLogin`](src/views/admin/AdminLogin.tsx:1)

### Páginas OIDC
- [`Login`](src/views/oidc/Login.tsx:21)
- [`Consent`](src/views/oidc/Consent.tsx:1)
- [`Error`](src/views/oidc/Error.tsx:1)

## Solução de Problemas

### Hydration Mismatch

Se você ver avisos de hidratação, certifique-se de:
1. Servidor e cliente renderizam HTML idêntico
2. Props são serializáveis (sem funções, referências circulares)
3. Componente renderiza de forma determinística

### Componente Não Encontrado

Se um componente falhar ao carregar:
1. Verifique se o nome do componente corresponde em [`src/client/index.tsx`](src/client/index.tsx:16)
2. Verifique se o caminho de import está correto
3. Verifique o console do navegador por erros

### Problemas de Build

Se o build falhar:
1. Certifique-se de que todas as dependências estão instaladas: `npm install`
2. Verifique erros TypeScript: `npm run build`
3. Limpe o cache: `rm -rf node_modules/.vite`

## Melhorias Futuras

Possíveis melhorias:

1. **Streaming SSR**: Usar capacidades de streaming do React 18
2. **Hydration Seletiva**: Hidratar apenas componentes interativos
3. **Error Boundaries**: Melhor tratamento de erros durante hidratação
4. **Suspense**: Implementar estados de carregamento para componentes assíncronos
5. **Service Worker**: Adicionar suporte offline com recursos PWA

## Recursos

- [Documentação de Hydration do React 18](https://react.dev/reference/react-dom/client/hydrateRoot)
- [Documentação do Vite](https://vitejs.dev/)
- [SSR com React](https://react.dev/reference/react-dom/server)
