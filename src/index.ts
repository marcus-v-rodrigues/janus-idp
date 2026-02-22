import { Provider, Configuration } from 'oidc-provider';
import express from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import { DrizzleAdapter, db } from './adapter';
import { schema } from './db';
import interactionRoutes from './routes/interaction';
import adminRoutes from './routes/admin';
import apiRoutes from './routes/api';
import { findAccount } from './services/account';
import { getPemKeys } from './utils/keys';

dotenv.config();

const port = process.env.APP_PORT || 3000;
const issuer = process.env.ISSUER_URL || `http://localhost:${port}/oidc`;

async function startServer() {
  // 1. Busca todos os clientes cadastrados no banco
  const dbClients = await db.select().from(schema.clients);

  // Extrai todos os escopos únicos definidos nos clientes no banco
  // Isso garante que se criar um cliente novo com 'read:photos', o servidor aceitará
  const supportedScopes = new Set(['openid']); // openid é sempre obrigatório
  dbClients.forEach(client => {
    if (client.scope) {
      client.scope.split(' ').forEach(s => supportedScopes.add(s));
    }
  });

  // 2. Mapeia do formato do Prisma para o formato do oidc-provider
  const clientsConfig = dbClients.map(c => ({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_types: c.grantTypes,
    redirect_uris: c.redirectUris,
    response_types: c.responseTypes,
    scope: c.scope || undefined,
  }));

  // Gera ou carrega chaves RSA para assinatura RS256
  const jwkKey = getPemKeys();

  const configuration: Configuration = {
    adapter: DrizzleAdapter,
    clients: clientsConfig as any,
    // O servidor aceita dinamicamente qualquer escopo que clientes possuam
    scopes: Array.from(supportedScopes),
    cookies: {
      keys: (process.env.COOKIE_KEYS || 'uma_chave_secreta_para_dev_1,uma_chave_secreta_para_dev_2').split(','),
      // Configurações de cookies para desenvolvimento e produção
      // Nota: NÃO definimos 'path' explicitamente - o oidc-provider usa o path do issuer automaticamente
      // Isso é crucial para que os cookies de interação funcionem corretamente
      long: {
        // Cookies de sessão de longa duração
        // secure: false em desenvolvimento para funcionar com HTTP
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
      short: {
        // Cookies de interação (curta duração)
        // secure: false em desenvolvimento para funcionar com HTTP
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    },
    pkce: {
      required: () => true,
    },
    // Configuração para emitir refresh tokens quando o scope offline_access for solicitado
    // O refresh_token não deve estar no array grant_types do cliente
    // Ele é automaticamente suportado quando configurado aqui
    issueRefreshToken: async (ctx, client, code) => {
      // Emite refresh token se o cliente permite e o scope inclui offline_access
      return (
        client.grantTypeAllowed('refresh_token')
        && code.scopes.has('offline_access')
      );
    },
    features: {
      devInteractions: { enabled: false },
      introspection: { enabled: true },
      revocation: { enabled: true },
    },
    interactions: {
      url(ctx, interaction) {
        // Importante: a URL de interação deve estar sob o mesmo path do OIDC Provider
        // para que os cookies de sessão sejam compartilhados corretamente
        return `/oidc/interaction/${interaction.uid}`;
      },
    },
    findAccount: findAccount,
    jwks: {
      keys: [jwkKey],
    },
    // Configurações de tempo de vida (TTL) para resolver o problema de expiração da sessão de interação
    // Aumentado para evitar o erro "authorization request has expired" durante o fluxo de autenticação
    ttl: {
      // Tempo de vida da sessão de interação OIDC (aumentado de 60s para 1 hora)
      Interaction: 3600, // 1 hora em segundos (padrão: 60 segundos)
      // Tempo de vida da sessão OIDC (aumentado de 14 dias para 30 dias)
      Session: 2592000, // 30 dias em segundos (padrão: 14 dias)
      // Tempo de vida do código de autorização (aumentado de 60s para 10 minutos)
      AuthorizationCode: 600, // 10 minutos em segundos (padrão: 60 segundos)
      // Tempo de vida do access token
      AccessToken: 3600, // 1 hora em segundos
      // Tempo de vida do refresh token
      RefreshToken: 2592000, // 30 dias em segundos
      // Tempo de vida do Grant (necessário para oidc-provider 9.x)
      // Grant armazena os consentimentos do usuário para um cliente
      Grant: 2592000, // 30 dias em segundos
    },
  };

  const app = express();

  // Essencial para o oidc-provider e cookies seguros quando rodando atrás de um 
  // reverse proxy (como NGINX, Traefik ou redes Docker), garantindo que o Express 
  // leia corretamente os headers X-Forwarded-Proto e X-Forwarded-For.
  app.set('trust proxy', true);
  /**
   * Configuração de Segurança com Helmet.
   */
  // Helmet para segurança - desabilitado CSP para páginas de interação OIDC
  // O CSP pode interferir com redirecionamentos do OIDC Provider
  app.use(helmet({
    contentSecurityPolicy: false, // Desabilita CSP para evitar problemas com OIDC
  }))

  // Configuração de sessão para autenticação do administrador
  // Aplicado antes dos parsers de corpo para estar disponível em todas as rotas
  app.use(session({
    secret: process.env.SESSION_SECRET || 'janus-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  }));

  // Arquivos estáticos
  app.use(express.static('./public'));

  // Healthcheck
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const oidc = new Provider(issuer, configuration);

  // Listener para capturar erros do servidor OIDC
  oidc.on('server_error', (ctx, error) => {
    console.error('[OIDC] Server Error:', error);
  });

  /**
   * Middleware condicional para o OIDC Provider.
   * 
   * IMPORTANTE: O oidc-provider precisa processar o corpo da requisição nativamente.
   * Se aplicarmos express.urlencoded() e express.json() globalmente antes do provider,
   * ele detecta que o corpo já foi parseado e gera o warning "already parsed request body detected".
   * 
   * Solução:
   * 1. Requisições para /oidc/interaction/* passam direto (next()) - serão processadas
   *    pelos parsers do Express, pois nossos formulários customizados dependem deles.
   * 2. Demais requisições /oidc/* são delegadas diretamente ao oidc.callback().
   * 
   * Nota: O callback do oidc-provider não aceita 'next' pois é um middleware final
   * que sempre envia uma resposta (baseado em Koa).
   */
  const oidcCallback = oidc.callback();
  
  app.use('/oidc', (req, res, next) => {
    // Verifica se é uma rota de interação que precisa dos parsers do Express
    // As rotas de interação (/oidc/interaction/*) usam formulários HTML customizados
    if (req.path.startsWith('/interaction/')) {
      // Deixa passar para os parsers do Express processarem
      return next();
    }
    // Para demais rotas OIDC, delega diretamente ao provider
    // O oidc-provider vai processar o corpo da requisição nativamente
    // Não passamos 'next' pois o callback é um middleware final
    return oidcCallback(req, res);
  });

  // Parsers de corpo aplicados globalmente DEPOIS do middleware OIDC condicional
  // Isso garante que o oidc-provider não receba o corpo já parseado
  // Rotas de interação e outras rotas customizadas terão acesso aos parsers
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Rotas de interação (login e consentimento)
  // Estas rotas dependem dos parsers do Express para processar formulários HTML
  app.use(interactionRoutes(oidc));

  // Rotas do Portal Administrativo
  app.use('/admin', adminRoutes);

  // Rotas da API para serviços externos
  app.use('/api', apiRoutes);

  app.listen(port, () => {
    console.log(`\n🚀 Janus IdP está online!`);
    console.log(`🌐 OpenID Configuration: ${issuer}/.well-known/openid-configuration`);
    console.log(`🔑 JWKS Endpoint: ${issuer}/jwks`);
    console.log(`📊 Clientes carregados do banco: ${clientsConfig.length}`);
    clientsConfig.forEach(c => console.log(`   - ${c.client_id}`));
    console.log(`\n🔐 Admin Portal: http://localhost:${port}/admin`);
    console.log(`\nPara testar, acesse o OIDC Debugger.`);
  });
}

startServer().catch(err => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});