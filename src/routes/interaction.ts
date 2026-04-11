import { Router, Request, Response } from 'express';
import { Provider } from 'oidc-provider';
import { db } from '../adapter';
import { schema } from '../db';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { renderView } from '../utils/renderer';
import { Login } from '../views/oidc/Login';
import { Consent } from '../views/oidc/Consent';
import { Error as ErrorView } from '../views/oidc/Error';
import { userHasClientAccess } from '../services/rbac';

const router = Router();

const { users, oidcPayloads } = schema;

/**
 * Escopos OIDC permitidos para consentimento.
 * Inclui offline_access para suportar Refresh Tokens.
 */
const ALLOWED_OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

/**
 * Conjunto em memória para rastrear UIDs de interação que já foram processados
 * para evitar loops de redirecionamento no auto-consent.
 * 
 * Importante: Este é um mecanismo de proteção contra re-submissão no curto prazo.
 * Os UIDs são removidos após 5 minutos para evitar vazamento de memória.
 */
const processedAutoConsentUids = new Map<string, NodeJS.Timeout>();

/**
 * Marca um UID como processado para auto-consent.
 * Remove a marca após 5 minutos para limpeza automática.
 */
function markAutoConsentProcessed(uid: string): void {
  // Remove o timeout anterior se existir (re-submissão rápida)
  if (processedAutoConsentUids.has(uid)) {
    const existingTimeout = processedAutoConsentUids.get(uid);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
  }

  // Define um novo timeout para limpar o UID após 5 minutos
  const timeout = setTimeout(() => {
    processedAutoConsentUids.delete(uid);
    console.log(`[Interaction] UID ${uid} removido do cache de auto-consent (expirado)`);
  }, 5 * 60 * 1000); // 5 minutos

  processedAutoConsentUids.set(uid, timeout);
  console.log(`[Interaction] UID ${uid} marcado como processado para auto-consent`);
}

/**
 * Verifica se um UID já foi processado para auto-consent.
 */
function isAutoConsentProcessed(uid: string): boolean {
  return processedAutoConsentUids.has(uid);
}

/**
 * Cria um router Express para lidar com as interações de login e consentimento.
 * 
 * Esta implementação segue o padrão exigido pelo oidc-provider 9.x, que requer
 * o uso explícito de objetos Grant para gerenciar consentimentos, em vez de
 * apenas retornar arrays de escopos.
 *
 * @param oidc - Instância do Provider oidc-provider
 * @returns Router Express configurado
 */
export default function interactionRoutes(oidc: Provider): Router {
  /**
   * Rota principal de interação - redireciona para a ação apropriada
   * Nota: O path deve ser /oidc/interaction/:uid para compartilhar cookies com o OIDC Provider
   */
  router.get('/oidc/interaction/:uid', async (req: Request, res: Response, next) => {
    try {
      console.log(`[Interaction] GET /oidc/interaction/${req.params.uid} - Headers:`, req.headers.cookie ? 'cookies present' : 'NO COOKIES');
      const { uid, prompt, params, session } = await oidc.interactionDetails(req, res);

      // Determina qual visualização renderizar com base no prompt
      const client = await oidc.Client.find(params.client_id as string);

      switch (prompt.name) {
        case 'login': {
          if (!client) {
            return res.status(400).send('Client not found');
          }
          return renderView(res, Login, {
            uid,
            client: {
              clientId: client.clientId,
              name: (client as any).name || null,
              logoUri: (client as any).logoUri || null,
              brandColor: (client as any).brandColor || null,
            },
            params,
            flash: undefined,
          }, {
            title: 'Entrar',
            // Não habilitar hidratação para o Login - o formulário precisa ser submetido nativamente
            // A hidratação do React pode interferir com o comportamento padrão do form
            componentName: 'Login',
            enableHydration: false
          });
        }
        case 'consent': {
          if (!client) {
            return res.status(400).send('Client not found');
          }

          // Aprovação automática se o mesmo usuário já estiver logado
          // Verifica se existe uma sessão com accountId
          if (session?.accountId) {
            console.log(`[Interaction] Auto-consent para usuário ${session.accountId} no cliente ${client.clientId}`);
            
            // Obtém os escopos que estão faltando no consentimento
            // O prompt.details contém missingOIDCScope, missingOIDCClaims, etc.
            const missingOIDCScope = (prompt.details as any)?.missingOIDCScope || [];
            const missingOIDCClaims = (prompt.details as any)?.missingOIDCClaims || [];
            const missingResourceScopes = (prompt.details as any)?.missingResourceScopes || {};
            
            console.log(`[Interaction] Escopos faltando: ${missingOIDCScope.join(', ') || 'nenhum'}`);
            console.log(`[Interaction] Claims faltando: ${missingOIDCClaims.join(', ') || 'nenhum'}`);

            // SOLUÇÃO: Cria um Grant explicitamente no auto-consent com os escopos necessários
            // Isso impede o loop porque o Grant já terá os escopos consentidos
            let grant;
            
            // Tenta encontrar um Grant existente para este usuário/cliente
            const existingGrants = await db.select()
              .from(oidcPayloads)
              .where(eq(oidcPayloads.type, 'Grant'));
            
            for (const grantRecord of existingGrants) {
              const payload = grantRecord.payload as any;
              if (payload.accountId === session.accountId && payload.clientId === client.clientId) {
                if (!grantRecord.expiresAt || grantRecord.expiresAt > new Date()) {
                  console.log(`[Interaction] Grant existente encontrado: ${grantRecord.id}`);
                  grant = await oidc.Grant.find(grantRecord.id);
                  if (grant) break;
                }
              }
            }

            // Se não encontrou, cria um novo Grant
            if (!grant) {
              console.log(`[Interaction] Criando novo Grant para auto-consent`);
              grant = new oidc.Grant({
                accountId: session.accountId,
                clientId: client.clientId,
              });
            }

            // Adiciona os escopos OIDC que estão faltando
            if (missingOIDCScope.length > 0) {
              const allowedScopes = missingOIDCScope.filter((s: string) => ALLOWED_OIDC_SCOPES.includes(s));
              if (allowedScopes.length > 0) {
                grant.addOIDCScope(allowedScopes.join(' '));
                console.log(`[Interaction] Escopos consentidos: ${allowedScopes.join(', ')}`);
              }
            }

            // Adiciona as claims OIDC que estão faltando
            if (missingOIDCClaims.length > 0) {
              grant.addOIDCClaims(missingOIDCClaims);
              console.log(`[Interaction] Claims consentidos: ${missingOIDCClaims.join(', ')}`);
            }

            // Adiciona os escopos de recursos (Resource Indicators)
            if (Object.keys(missingResourceScopes).length > 0) {
              for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
                grant.addResourceScope(indicator, (scopes as string[]).join(' '));
                console.log(`[Interaction] Resource scopes para ${indicator}: ${(scopes as string[]).join(', ')}`);
              }
            }

            // Salva o Grant e obtém o grantId
            const newGrantId = await grant.save();
            console.log(`[Interaction] Grant salvo com ID: ${newGrantId}`);
            
            console.log(`[Interaction] Finalizando auto-consent para uid: ${uid}`);

            // Finaliza a interação retornando o grantId no objeto consent
            // Isso é crucial para que o oidc-provider não tente criar um novo Grant
            const consentResult = {
              consent: {
                grantId: newGrantId,
              },
            };

            console.log(`[Interaction] Chamando interactionFinished para auto-consent...`);
            await oidc.interactionFinished(req, res, consentResult, { mergeWithLastSubmission: true });
            console.log(`[Interaction] interactionFinished executado com sucesso`);
            return;
          }

          // Caso contrário, mostra a tela de consentimento usando React
          return renderView(res, Consent, {
            uid,
            client: {
              clientId: client.clientId,
              name: (client as any).name || null,
              logoUri: (client as any).logoUri || null,
              brandColor: (client as any).brandColor || null,
            },
            params,
            flash: undefined,
          }, {
            title: 'Authorize',
            // Não habilitar hidratação para o Consent - o formulário precisa ser submetido nativamente
            componentName: 'Consent',
            enableHydration: false
          });
        }
        default: {
          return renderView(res, ErrorView, {
            error: 'Unknown prompt',
            message: `Unknown prompt: ${prompt.name}`,
          }, { 
            title: 'Error',
            componentName: 'Error',
            enableHydration: true 
          });
        }
      }
    } catch (err) {
      return next(err);
    }
  });

  /**
   * Rota para submissão do formulário de login
   * Implementa verificação de autorização: usuário deve estar vinculado ao cliente
   * Nota: O path deve ser /oidc/interaction/:uid/login para compartilhar cookies com o OIDC Provider
   */
  router.post('/oidc/interaction/:uid/login', async (req: Request, res: Response, next) => {
    try {
      console.log(`[Interaction] POST /oidc/interaction/${req.params.uid}/login - Headers:`, req.headers.cookie ? 'cookies present' : 'NO COOKIES');
      const { uid, prompt, params } = await oidc.interactionDetails(req, res);
      const client = await oidc.Client.find(params.client_id as string);

      if (!client) {
        return res.status(400).send('Client not found');
      }

      const { email, password } = req.body;

      const clientData = {
        clientId: client.clientId,
        name: (client as any).name || null,
        logoUri: (client as any).logoUri || null,
        brandColor: (client as any).brandColor || null,
      };

      // Validação básica dos campos
      if (!email || !password) {
        return renderView(res, Login, {
          uid,
          client: clientData,
          params,
          flash: 'Informe email e senha.',
        }, { title: 'Entrar' });
      }

      // Busca o usuário no banco de dados pelo email
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = result[0];

      if (!user) {
        return renderView(res, Login, {
          uid,
          client: clientData,
          params,
          flash: 'Email ou senha inválidos.',
        }, { title: 'Entrar' });
      }

      // Verifica se a senha está correta usando bcrypt
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return renderView(res, Login, {
          uid,
          client: clientData,
          params,
          flash: 'Email ou senha inválidos.',
        }, { title: 'Entrar' });
      }

      const hasClientAccess = await userHasClientAccess(user.id, client.clientId);

      if (!hasClientAccess) {
        console.log(`[Interaction] Access denied: user ${user.sub} not authorized for client ${client.clientId}`);

        return renderView(res, ErrorView, {
          error: 'Acesso negado',
          message: 'Você está autenticado, mas não tem autorização para acessar esta aplicação.',
        }, {
          title: 'Acesso negado',
          componentName: 'Error',
          enableHydration: true
        });
      }

      console.log(`[Interaction] Access granted: user ${user.sub} authorized for client ${client.clientId}`);

      // Cria o resultado da interação de login
      const result2 = {
        login: {
          accountId: user.sub,
          // Claims do usuário que serão retornados no token
          acr: 'urn:mace:incommon:iap:silver',
          amr: ['pwd'],
          remember: !!req.body.remember,
          ts: Math.floor(Date.now() / 1000),
        },
      };

      console.log(`[Interaction] Finalizando interação de login para uid: ${uid}`);
      
      // Finaliza a interação com sucesso
      // O interactionFinished envia um redirecionamento HTTP 303
      console.log(`[Interaction] Chamando interactionFinished...`);
      await oidc.interactionFinished(req, res, result2, { mergeWithLastSubmission: false });
      console.log(`[Interaction] interactionFinished retornou - resposta enviada`);
    } catch (err) {
      console.error('[Interaction] Error during login:', err);
      next(err);
    }
  });

  /**
   * Rota para submissão do formulário de consentimento (aprovação manual)
   *
   * Implementa o padrão exigido pelo oidc-provider 9.x usando objetos Grant
   * para rastrear os escopos consentidos pelo usuário.
   * Segue o padrão do código oficial do oidc-provider em lib/actions/interaction.js
   * Nota: O path deve ser /oidc/interaction/:uid/confirm para compartilhar cookies com o OIDC Provider
   */
  router.post('/oidc/interaction/:uid/confirm', async (req: Request, res: Response, next) => {
    try {
      // Obtém os detalhes da interação, incluindo grantId se existir
      const interactionDetails = await oidc.interactionDetails(req, res);
      const { prompt, params, session, grantId } = interactionDetails;
      const client = await oidc.Client.find(params.client_id as string);

      if (!client) {
        return res.status(400).send('Client not found');
      }

      const { consent } = req.body;

      // Se o usuário não consentiu, cancela a interação
      if (!consent) {
        const result = {
          error: 'access_denied',
          error_description: 'User denied the consent',
        };
        return oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
      }

      // Verifica se temos um accountId da sessão (obrigatório para criar um Grant)
      if (!session?.accountId) {
        console.error('[Interaction] Consent sem accountId na sessão');
        return renderView(res, ErrorView, {
          error: 'Session Error',
          message: 'Sessão não encontrada. Por favor, faça login novamente.',
        }, {
          title: 'Error',
          componentName: 'Error',
          enableHydration: true
        });
      }

      console.log(`[Interaction] Processando consentimento para usuário ${session.accountId} no cliente ${client.clientId}`);

      // Obtém os escopos e claims que estão faltando
      const missingOIDCScope = (prompt.details as any)?.missingOIDCScope || [];
      const missingOIDCClaims = (prompt.details as any)?.missingOIDCClaims || [];
      const missingResourceScopes = (prompt.details as any)?.missingResourceScopes || {};

      let grant;

      // Se já existe um grantId, busca o Grant existente para modificá-lo
      if (grantId) {
        console.log(`[Interaction] Buscando Grant existente: ${grantId}`);
        grant = await oidc.Grant.find(grantId);
      }

      // Se não encontrou o Grant ou não existia, cria um novo
      if (!grant) {
        console.log(`[Interaction] Criando novo Grant`);
        grant = new oidc.Grant({
          accountId: session.accountId,
          clientId: client.clientId,
        });
      }

      // Adiciona os escopos OIDC que estão faltando
      if (missingOIDCScope.length > 0) {
        // Filtra apenas os escopos permitidos
        const allowedScopes = missingOIDCScope.filter((s: string) => ALLOWED_OIDC_SCOPES.includes(s));
        if (allowedScopes.length > 0) {
          grant.addOIDCScope(allowedScopes.join(' '));
          console.log(`[Interaction] Escopos consentidos: ${allowedScopes.join(', ')}`);
        }
      }

      // Adiciona as claims OIDC que estão faltando
      if (missingOIDCClaims.length > 0) {
        grant.addOIDCClaims(missingOIDCClaims);
        console.log(`[Interaction] Claims consentidos: ${missingOIDCClaims.join(', ')}`);
      }

      // Adiciona os escopos de recursos (Resource Indicators)
      if (Object.keys(missingResourceScopes).length > 0) {
        for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
          grant.addResourceScope(indicator, (scopes as string[]).join(' '));
          console.log(`[Interaction] Resource scopes para ${indicator}: ${(scopes as string[]).join(', ')}`);
        }
      }

      // Salva o Grant no armazenamento e obtém o grantId
      const newGrantId = await grant.save();
      console.log(`[Interaction] Grant salvo com ID: ${newGrantId}`);

      // Finaliza a interação retornando o grantId no objeto consent
      // mergeWithLastSubmission: true é importante para preservar o estado do login
      const consentResult = {
        consent: {
          grantId: newGrantId,
        },
      };

      await oidc.interactionFinished(req, res, consentResult, { mergeWithLastSubmission: true });
    } catch (err) {
      console.error('[Interaction] Error during consent:', err);
      next(err);
    }
  });

  /**
   * Rota para abortar a interação (usuário cancelou)
   * Nota: O path deve ser /oidc/interaction/:uid/abort para compartilhar cookies com o OIDC Provider
   */
  router.post('/oidc/interaction/:uid/abort', async (req: Request, res: Response, next) => {
    try {
      const result = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      };
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
