import { Provider, Configuration } from 'oidc-provider';
import express from 'express';
import * as dotenv from 'dotenv';
import { PrismaAdapter } from './adapter';
import helmet from 'helmet';

dotenv.config();

const port = process.env.PORT || 3000;
/**
 * O issuer é a URL base do seu IdP. 
 */
const issuer = process.env.ISSUER_URL || `http://localhost:${port}/oidc`;

const configuration: Configuration = {
  adapter: PrismaAdapter,
  clients: [
    {
      client_id: process.env.OIDC_CLIENT_ID || 'test_client',
      client_secret: process.env.OIDC_CLIENT_SECRET || 'test_secret',
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: (process.env.OIDC_REDIRECT_URIS || 'https://oidcdebugger.com/debug').split(','),
      response_types: ['code'],
    },
  ],
  cookies: {
    keys: (process.env.COOKIE_KEYS || 'default_secret_key').split(','),
  },
  features: {
    devInteractions: { enabled: true },
    introspection: { enabled: true },
    revocation: { enabled: true },
  },
  // Em modo de desenvolvimento, se deixarmos as chaves vazias, o oidc-provider gera chaves temporárias.
  jwks: {
    keys: [],
  },
};

const app = express();

/**
 * Configuração de Segurança com Helmet.
 * O oidc-provider já gerencia diversos headers, mas o helmet adiciona uma camada extra.
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
  console.log(`🔑 Client ID: '${process.env.OIDC_CLIENT_ID || 'test_client'}' | Secret: '${process.env.OIDC_CLIENT_SECRET || 'test_secret'}'`);
  console.log(`\nPara testar, acesse o OIDC Debugger com as configurações acima.`);
});
