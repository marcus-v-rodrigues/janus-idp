import { KoaContextWithOIDC } from 'oidc-provider';
import { prisma } from '../adapter';

/**
 * Função para encontrar uma conta de usuário no banco de dados.
 * Esta função é usada pelo oidc-provider para recuperar informações do usuário.
 *
 * @param ctx - Contexto do Koa com informações OIDC
 * @param sub - Subject identifier (ID do usuário)
 * @param token - Token opcional para contexto adicional
 * @returns Objeto com informações da conta ou undefined se não encontrado
 */
export async function findAccount(
  ctx: KoaContextWithOIDC,
  sub: string,
  token?: any
): Promise<undefined | { accountId: string; async: any; claims: (...args: any[]) => any }> {
  try {
    // Busca o usuário no banco de dados
    const user = await prisma.user.findUnique({
      where: { id: sub },
    });

    if (!user) {
      return undefined;
    }

    return {
      accountId: sub,
      async: () => {
        // Função assíncrona que retorna os claims do usuário
        return {
          sub: user.id,
          email: user.email,
          email_verified: user.emailVerified,
          name: user.name || user.email,
        };
      },
      // Função síncrona para claims básicos
      claims: (...scopes: string[]) => {
        const claims: any = {
          sub: user.id,
        };

        // Adiciona claims baseados nos escopos solicitados
        for (const scope of scopes) {
          switch (scope) {
            case 'profile':
              claims.name = user.name || user.email;
              break;
            case 'email':
              claims.email = user.email;
              claims.email_verified = user.emailVerified;
              break;
          }
        }

        return claims;
      },
    };
  } catch (err) {
    console.error('Error finding account:', err);
    return undefined;
  }
}
