import { KoaContextWithOIDC, type Account, type AccountClaims, type ClaimsParameterMember } from 'oidc-provider';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';
import { getUserRoles } from './rbac';

const { users } = schema;

/**
 * Localiza a conta associada ao `sub` informado.
 * O `sub` é o identificador canônico do usuário no OIDC.
 */
export async function findAccount(
  ctx: KoaContextWithOIDC,
  sub: string,
  token?: any
): Promise<Account | undefined> {
  try {
    const result = await db.select().from(users).where(eq(users.sub, sub)).limit(1);
    const user = result[0];

    if (!user) {
      return undefined;
    }

    const userRoles = await getUserRoles(user.id);
    const globalRoles = userRoles.filter((role) => role.scopeType === 'GLOBAL').map((role) => role.code);
    const requestedClientId = ctx.oidc?.client?.clientId ?? token?.clientId ?? null;
    const clientRoles = userRoles
      .filter((role) => role.scopeType === 'CLIENT')
      .filter((role) => !requestedClientId || role.clientId === requestedClientId)
      .map((role) => ({
        code: role.code,
        clientId: role.clientId,
      }));

    return {
      accountId: user.sub,
      claims: async (
        use: string,
        scope: string,
        claims: { [key: string]: null | ClaimsParameterMember },
        rejected: string[],
      ): Promise<AccountClaims> => {
        const scopes = new Set(scope.split(' '));
        const result: AccountClaims = {
          sub: user.sub,
        };

        if (scopes.has('profile')) {
          result.name = user.name || user.email;
        }

        if (scopes.has('email')) {
          result.email = user.email;
          result.email_verified = user.emailVerified;
        }

        if (use === 'id_token' && scopes.has('profile')) {
          result.roles = {
            global: globalRoles,
            client: clientRoles,
          };
        }

        return result;
      },
    };
  } catch (err) {
    console.error('Erro ao localizar a conta:', err);
    return undefined;
  }
}
