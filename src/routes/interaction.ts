import { Router, Request, Response } from 'express';
import { Provider } from 'oidc-provider';
import { prisma } from '../adapter';
import * as bcrypt from 'bcryptjs';

const router = Router();

/**
 * Cria um router Express para lidar com as interações de login e consentimento.
 *
 * @param oidc - Instância do Provider oidc-provider
 * @returns Router Express configurado
 */
export default function interactionRoutes(oidc: Provider): Router {
  /**
   * Rota principal de interação - redireciona para a ação apropriada
   */
  router.get('/interaction/:uid', async (req: Request, res: Response, next) => {
    try {
      const { uid, prompt, params, session } = await oidc.interactionDetails(req, res);

      // Determina qual view renderizar baseado no prompt
      const client = await oidc.Client.find(params.client_id as string);

      switch (prompt.name) {
        case 'login': {
          return res.render('interaction/login', {
            uid,
            client,
            params,
            title: 'Sign in',
            details: prompt.details,
            flash: undefined,
          });
        }
        case 'consent': {
          // Aprovação automática se o mesmo usuário já estiver logado
          // Verifica se existe uma sessão com accountId
          if (session?.accountId) {
            // Aprova automaticamente o consentimento para MVP
            const consentResult: any = {
              consent: {},
            };

            // Adiciona escopos se presentes
            if (params.scope) {
              const scopes = (params.scope as string).split(' ');
              const oidcScopes = scopes.filter((s) => ['openid', 'profile', 'email'].includes(s));
              if (oidcScopes.length > 0) {
                consentResult.consent.scope = oidcScopes;
              }
            }

            // Finaliza a interação com aprovação automática
            return oidc.interactionFinished(req, res, consentResult, { mergeWithLastSubmission: false });
          }

          // Caso contrário, mostra a tela de consentimento
          return res.render('interaction/consent', {
            uid,
            client,
            params,
            title: 'Authorize',
            details: prompt.details,
            session,
            flash: undefined,
          });
        }
        default: {
          return res.status(400).render('interaction/error', {
            error: 'Unknown prompt',
            message: `Unknown prompt: ${prompt.name}`,
          });
        }
      }
    } catch (err) {
      return next(err);
    }
  });

  /**
   * Rota para submissão do formulário de login
   */
  router.post('/interaction/:uid/login', async (req: Request, res: Response, next) => {
    try {
      const { uid, prompt, params } = await oidc.interactionDetails(req, res);
      const client = await oidc.Client.find(params.client_id as string);

      const { email, password } = req.body;

      // Validação básica dos campos
      if (!email || !password) {
        return res.render('interaction/login', {
          uid,
          client,
          params,
          title: 'Sign in',
          details: prompt.details,
          flash: 'Please provide both email and password',
        });
      }

      // Busca o usuário no banco de dados pelo email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.render('interaction/login', {
          uid,
          client,
          params,
          title: 'Sign in',
          details: prompt.details,
          flash: 'Invalid email or password',
        });
      }

      // Verifica se a senha está correta usando bcrypt
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.render('interaction/login', {
          uid,
          client,
          params,
          title: 'Sign in',
          details: prompt.details,
          flash: 'Invalid email or password',
        });
      }

      // Cria o resultado da interação de login
      const result = {
        login: {
          accountId: user.id,
          // Claims do usuário que serão retornados no token
          acr: 'urn:mace:incommon:iap:silver',
          amr: ['pwd'],
          remember: !!req.body.remember,
          ts: Math.floor(Date.now() / 1000),
        },
      };

      // Finaliza a interação com sucesso
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Rota para submissão do formulário de consentimento
   */
  router.post('/interaction/:uid/confirm', async (req: Request, res: Response, next) => {
    try {
      const interactionDetails = await oidc.interactionDetails(req, res);
      const { prompt, params, session } = interactionDetails;
      const { uid } = interactionDetails;
      const client = await oidc.Client.find(params.client_id as string);

      const { consent } = req.body;

      // Se o usuário não consentiu, cancela a interação
      if (!consent) {
        const result = {
          error: 'access_denied',
          error_description: 'User denied the consent',
        };
        return oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
      }

      // Cria o resultado da interação de consentimento
      const consentResult: any = {
        consent: {
          // Marca que o usuário consentiu com os escopos solicitados
        },
      };

      // Se houver escopos OIDC, adiciona ao resultado
      if (params.scope) {
        const scopes = (params.scope as string).split(' ');
        const oidcScopes = scopes.filter((s) => ['openid', 'profile', 'email'].includes(s));
        if (oidcScopes.length > 0) {
          consentResult.consent.scope = oidcScopes;
        }
      }

      // Finaliza a interação com sucesso
      await oidc.interactionFinished(req, res, consentResult, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Rota para abortar a interação (usuário cancelou)
   */
  router.post('/interaction/:uid/abort', async (req: Request, res: Response, next) => {
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
