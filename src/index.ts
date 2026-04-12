import { Provider, Configuration, errors } from 'oidc-provider';
import express from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import { DrizzleAdapter, db } from './adapter';
import { schema } from './db';
import { eq } from 'drizzle-orm';
import interactionRoutes from './routes/interaction';
import adminRoutes from './routes/admin';
import apiRoutes from './routes/api';
import { findAccount } from './services/account';
import { getPemKeys } from './utils/keys';

dotenv.config();

const port = process.env.APP_PORT || 3000;
const issuer = process.env.ISSUER_URL || `http://localhost:${port}/oidc`;
const resourceIndicatorPolicy = process.env.JANUS_RESOURCE_INDICATOR_POLICY === 'require'
  ? 'require'
  : 'fallback';
const defaultResourceIndicator = process.env.JANUS_DEFAULT_RESOURCE || `${issuer}/api`;
const resourceIndicatorState = new WeakMap<object, {
  requestedResource?: string | string[];
  effectiveResourceIndicator: string;
  fallbackUsed: boolean;
  policy: typeof resourceIndicatorPolicy;
}>();

function logResourceIndicatorEvent(event: string, details: Record<string, unknown>) {
  console.info(`[OIDC][resourceIndicators] ${event}`, details);
}

function getClientId(client?: { clientId?: string } | null) {
  return client?.clientId ?? 'unknown-client';
}

function getRequestedResource(ctx: { oidc?: { params?: { resource?: string | string[] } } }) {
  return ctx.oidc?.params?.resource;
}

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
    claims: {
      openid: ['sub'],
      profile: ['name', 'roles'],
      email: ['email', 'email_verified'],
    },
    // Configuração para carregar Grants existentes e evitar loops de interação
    loadExistingGrant: async (ctx) => {
      console.log('[loadExistingGrant] Hook chamado');
      
      // Tenta obter o grantId do resultado da interação ou da sessão
      const grantId = ctx.oidc.result?.consent?.grantId;
      console.log(`[loadExistingGrant] grantId do resultado: ${grantId}`);
      
      // Se temos um grantId, tenta encontrar o Grant existente
      if (grantId) {
        const grant = await ctx.oidc.provider.Grant.find(grantId);
        if (grant) {
          console.log(`[loadExistingGrant] Grant encontrado: ${grantId}`);
          return grant;
        }
        console.log(`[loadExistingGrant] Grant não encontrado: ${grantId}`);
      }
      
      // OTIMIZAÇÃO: Busca Grants existentes no banco de dados antes de criar um novo
      // Isso evita a inflação de registros de Grant durante redirecionamentos
      const accountId = ctx.oidc.session?.accountId;
      const clientId = ctx.oidc.client?.clientId;
      
      console.log(`[loadExistingGrant] accountId: ${accountId}, clientId: ${clientId}`);
      
      if (accountId && clientId) {
        // Busca todos os Grants do tipo 'Grant' no banco de dados
        // Filtra por accountId e clientId no payload
        const existingGrants = await db.select()
          .from(schema.oidcPayloads)
          .where(eq(schema.oidcPayloads.type, 'Grant'));
        
        // Procura um Grant existente que corresponda ao accountId e clientId
        for (const grantRecord of existingGrants) {
          const payload = grantRecord.payload as any;
          if (payload.accountId === accountId && payload.clientId === clientId) {
            // Verifica se o Grant não expirou
            if (!grantRecord.expiresAt || grantRecord.expiresAt > new Date()) {
              console.log(`[loadExistingGrant] Grant existente encontrado no banco: ${grantRecord.id}`);
              // Carrega o Grant usando o provider
              const grant = await ctx.oidc.provider.Grant.find(grantRecord.id);
              if (grant) {
                console.log(`[loadExistingGrant] Reutilizando Grant existente: ${grantRecord.id}`);
                return grant;
              }
            }
          }
        }
        
        // Se não encontrou um Grant existente, cria um novo automaticamente
        // Isso é necessário para o fluxo de auto-consent funcionar corretamente
        // e evitar o erro "SessionNotFound: invalid_request"
        console.log(`[loadExistingGrant] Nenhum Grant existente encontrado, criando novo`);
        
        // Cria um novo Grant vazio
        // O oidc-provider vai adicionar os escopos automaticamente quando necessário
        const grant = new ctx.oidc.provider.Grant({
          accountId,
          clientId,
        });
        
        // Salva o Grant e retorna
        const newGrantId = await grant.save();
        console.log(`[loadExistingGrant] Novo Grant criado: ${newGrantId}`);
        return grant;
      }
      
      console.log('[loadExistingGrant] Retornando undefined (nenhum Grant criado)');
      return undefined;
    },
    // Função customizada para renderizar erros e capturar informações de debug
    renderError: async (ctx, out, error) => {
      console.error('[OIDC] renderError chamado:', {
        error: error,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        oidc: ctx.oidc,
        out: out,
      });

      // Informações de depuração adicionais para SessionNotFound
      let debugInfo = '';
      if (error.name === 'SessionNotFound') {
        // Acessa error_description de forma segura usando type assertion
        const errorDesc = (error as any).error_description || 'N/A';
        
        debugInfo = `
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #856404;">🔍 Informações de Depuração - SessionNotFound</h3>
            <p><strong>Causa provável:</strong> A sessão de autorização expirou ou não foi encontrada.</p>
            <p><strong>Soluções possíveis:</strong></p>
            <ul>
              <li>Tente fazer login novamente</li>
              <li>Verifique se os cookies estão habilitados no navegador</li>
              <li>Verifique se não há bloqueadores de pop-up ou redirecionamento</li>
              <li>Se o problema persistir, entre em contato com o administrador</li>
            </ul>
            <p><strong>Detalhes técnicos:</strong></p>
            <ul>
              <li>Erro: ${error.message}</li>
              <li>Descrição: ${errorDesc}</li>
              ${ctx.oidc.session ? `<li>Sessão UID: ${ctx.oidc.session.uid}</li>` : '<li>Sessão: não encontrada</li>'}
              ${ctx.oidc.session?.accountId ? `<li>Account ID: ${ctx.oidc.session.accountId}</li>` : ''}
            </ul>
          </div>
        `;
      }

      // Renderiza a página de erro padrão do oidc-provider
      ctx.body = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 4px; }
            .error h1 { color: #c33; margin-top: 0; }
            .error pre { background: #f5f5f5; padding: 10px; overflow: auto; }
            .error ul { margin: 10px 0; padding-left: 20px; }
            .error li { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Authentication Error</h1>
            <p><strong>Error:</strong> ${error.name}</p>
            <p><strong>Message:</strong> ${error.message}</p>
            ${debugInfo}
            ${error.stack ? `<pre>${error.stack}</pre>` : ''}
            <p><a href="/admin">Return to Admin Portal</a></p>
          </div>
        </body>
        </html>
      `;
      ctx.status = 500;
    },
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
    routes: {
      userinfo: '/userinfo',
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
      userinfo: { enabled: true },
      introspection: { enabled: true },
      revocation: { enabled: true },
      // Resource Indicators (RFC8707) - Necessário para emitir JWTs em vez de opaque tokens
      // O caminho preferencial é o client enviar `resource` explicitamente.
      // O fallback controlado só existe para preservar compatibilidade durante a transição.
      resourceIndicators: {
        enabled: true,
        // Fallback controlado quando o cliente não envia `resource`.
        // Em modo `require`, a ausência de `resource` é rejeitada explicitamente.
        defaultResource: async (ctx, client, oneOf) => {
          const clientId = getClientId(client);
          const requestedResource = getRequestedResource(ctx) ?? oneOf ?? null;

          if (resourceIndicatorPolicy === 'require') {
            logResourceIndicatorEvent('missing-resource-rejected', {
              client_id: clientId,
              requested_resource: requestedResource,
              policy: resourceIndicatorPolicy,
            });

            throw new errors.InvalidTarget('resource indicator must be provided explicitly');
          }

          const effectiveResourceIndicator = defaultResourceIndicator;
          resourceIndicatorState.set(ctx as object, {
            requestedResource: requestedResource ?? undefined,
            effectiveResourceIndicator,
            fallbackUsed: true,
            policy: resourceIndicatorPolicy,
          });

          logResourceIndicatorEvent('missing-resource-fallback', {
            client_id: clientId,
            requested_resource: requestedResource,
            fallback_resource: effectiveResourceIndicator,
            policy: resourceIndicatorPolicy,
          });

          return effectiveResourceIndicator;
        },
        // Retorna a configuração do Resource Server para o resource indicator efetivo.
        // O `aud` do access token JWT continua sendo controlado pelo fluxo do oidc-provider.
        getResourceServerInfo: async (ctx, resourceIndicator, client) => {
          const clientId = getClientId(client);
          const resourceState = resourceIndicatorState.get(ctx as object);
          const fallbackUsed = resourceState?.fallbackUsed ?? false;

          logResourceIndicatorEvent('resource-server-resolved', {
            client_id: clientId,
            requested_resource: resourceState?.requestedResource ?? getRequestedResource(ctx) ?? null,
            effective_resource: resourceIndicator,
            fallback_used: fallbackUsed,
            policy: resourceState?.policy ?? resourceIndicatorPolicy,
            audience: resourceIndicator,
          });

          return {
            scope: Array.from(supportedScopes).join(' '),
            // IMPORTANTE: Define o formato do access token como JWT.
            accessTokenFormat: 'jwt',
            // Configuração da assinatura JWT usando RS256.
            jwt: {
              sign: { alg: 'RS256' },
            },
          };
        },
        // Usa o recurso concedido quando disponível
        useGrantedResource: async (ctx, model) => {
          return true;
        },
      },
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
  console.info('[OIDC][resourceIndicators] policy-configured', {
    policy: resourceIndicatorPolicy,
    default_resource: defaultResourceIndicator,
  });

  // Listener para capturar erros do servidor OIDC
  oidc.on('server_error', (ctx, error) => {
    console.error('[OIDC] Server Error:', error);
    console.error('[OIDC] Server Error Details:', {
      error: error,
      message: error.message,
      stack: error.stack,
      oidc: ctx.oidc,
    });
  });

  // Listener para capturar erros de autorização
  oidc.on('authorization.error', (ctx, error) => {
    console.error('[OIDC] Authorization Error:', error);
    console.error('[OIDC] Authorization Error Details:', {
      error: error,
      message: error.message,
      stack: error.stack,
      oidc: ctx.oidc,
    });
  });

  // Listener para capturar eventos de concessão (grant) com erro
  oidc.on('grant.error', (ctx, error) => {
    console.error('[OIDC] Grant error:', error);
    console.error('[OIDC] Grant Error Details:', {
      error: error,
      message: error.message,
      stack: error.stack,
      oidc: ctx.oidc,
    });
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

    if (req.path === '/userinfo') {
      console.log('[OIDC][HTTP][userinfo] request', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });

      const chunks: Buffer[] = [];
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      (res as any).write = (chunk: any, encoding?: any, callback?: any) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }

        return originalWrite(chunk, encoding, callback);
      };

      (res as any).end = (chunk?: any, encoding?: any, callback?: any) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }

        const responseBody = Buffer.concat(chunks).toString('utf8');
        const contentType = res.getHeader('content-type') ?? null;
        const responseSummary: Record<string, unknown> = {
          bodyLength: responseBody.length,
        };

        if (typeof contentType === 'string' && contentType.includes('application/json') && responseBody) {
          try {
            const parsed = JSON.parse(responseBody) as Record<string, unknown>;
            responseSummary.keys = Object.keys(parsed);
            responseSummary.hasRoles = Object.prototype.hasOwnProperty.call(parsed, 'roles');
          } catch {
            responseSummary.parseable = false;
          }
        } else if (responseBody) {
          responseSummary.responseKind = contentType;
        }

        console.log('[OIDC][HTTP][userinfo] response', {
          statusCode: res.statusCode,
          contentType,
          ...responseSummary,
        });

        return originalEnd(chunk, encoding, callback);
      };
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
    console.log(`\nPara testar, use o cliente OIDC configurado (UX Auditor).`);
  });
}

startServer().catch(err => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
