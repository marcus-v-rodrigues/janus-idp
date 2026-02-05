import { Provider, Configuration } from 'oidc-provider';
import express from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaAdapter, prisma } from './adapter';

dotenv.config();

const port = process.env.PORT || 3000;
const issuer = process.env.ISSUER_URL || `http://localhost:${port}/oidc`;

async function startServer() {
  // 1. Busca todos os clientes cadastrados no banco
  const dbClients = await prisma.client.findMany();

  // 2. Mapeia do formato do Prisma para o formato do oidc-provider
  const clientsConfig = dbClients.map(c => ({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_types: c.grantTypes,
    redirect_uris: c.redirectUris,
    response_types: c.responseTypes,
    scope: c.scope || undefined,
  }));

  const configuration: Configuration = {
    adapter: PrismaAdapter,
    clients: clientsConfig as any,
    cookies: {
      keys: (process.env.COOKIE_KEYS || 'uma_chave_secreta_para_dev_1,uma_chave_secreta_para_dev_2').split(','),
    },
    features: {
      devInteractions: { enabled: true },
      introspection: { enabled: true },
      revocation: { enabled: true },
    },
    jwks: {
      keys: [],
    },
  };

  const app = express();

  /**
   * Configuração de Segurança com Helmet.
   */
  app.use(helmet());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const oidc = new Provider(issuer, configuration);

  // Rota principal do OIDC montada no path /oidc
  app.use('/oidc', oidc.callback());

  app.listen(port, () => {
    console.log(`\n🚀 Janus IdP está online!`);
    console.log(`🌐 OpenID Configuration: ${issuer}/.well-known/openid-configuration`);
    console.log(`📊 Clientes carregados do banco: ${clientsConfig.length}`);
    clientsConfig.forEach(c => console.log(`   - ${c.client_id}`));
    console.log(`\nPara testar, acesse o OIDC Debugger.`);
  });
}

startServer().catch(err => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});