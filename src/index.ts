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
        return `/interaction/${interaction.uid}`;
      },
    },
    findAccount: findAccount,
    jwks: {
      keys: [jwkKey],
    },
  };

  const app = express();

  /**
   * Configuração de Segurança com Helmet.
   */
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Adicionado 'unsafe-inline' para o Tailwind injetar os estilos e cdn.tailwindcss.com para o script
        styleSrc: ["'self'", "'unsafe-inline'"], 
        scriptSrc: ["'self'", "cdn.tailwindcss.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"], // Opcional: permite conexões locais
      },
    },
  }))

  // Configuração do Express
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Configuração de sessão para autenticação do administrador
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

  // Rotas de interação (login e consentimento)
  app.use(interactionRoutes(oidc));

  // Rotas do Portal Administrativo
  app.use('/admin', adminRoutes);

  // Rotas da API para serviços externos
  app.use('/api', apiRoutes);

  // Rota principal do OIDC montada no path /oidc
  app.use('/oidc', oidc.callback());

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