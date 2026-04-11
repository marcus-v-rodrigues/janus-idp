import { KoaContextWithOIDC, type Account, type AccountClaims, type ClaimsParameterMember } from 'oidc-provider';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';
import { getUserRoles } from './rbac';
import {
  buildCanonicalRoleClaims,
  summarizeCanonicalRoleClaims,
  type CanonicalRoleClaims,
} from './oidcClaims';

const { users } = schema;

function parseScopes(scope: string): Set<string> {
  return new Set(
    scope
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function shouldEmitRoles(use: string, scopes: Set<string>): boolean {
  return (use === 'id_token' || use === 'userinfo') && scopes.has('profile');
}

function buildClaimLog(input: {
  accountId: string;
  clientId: string | null;
  use: string;
  scope: string;
  scopes: Set<string>;
  result: AccountClaims;
  roles: CanonicalRoleClaims;
}) {
  const emitRoles = shouldEmitRoles(input.use, input.scopes);

  return {
    accountId: input.accountId,
    clientId: input.clientId,
    use: input.use,
    requestedScope: input.scope,
    requestedScopes: Array.from(input.scopes),
    emitRoles,
    claimKeys: Object.keys(input.result),
    roles: emitRoles ? summarizeCanonicalRoleClaims(input.roles) : null,
    reason: emitRoles ? 'profile scope present' : 'profile scope missing or unsupported use',
  };
}

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
    const requestedClientId = ctx.oidc?.client?.clientId ?? token?.clientId ?? null;
    const roleClaims = buildCanonicalRoleClaims(userRoles, requestedClientId);

    return {
      accountId: user.sub,
      claims: async (
        use: string,
        scope: string,
        claims: { [key: string]: null | ClaimsParameterMember },
        rejected: string[],
      ): Promise<AccountClaims> => {
        const scopes = parseScopes(scope);
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

        if (shouldEmitRoles(use, scopes)) {
          result.roles = roleClaims;
        }

        console.info('[OIDC][claims]', buildClaimLog({
          accountId: user.sub,
          clientId: requestedClientId,
          use,
          scope,
          scopes,
          result,
          roles: roleClaims,
        }));

        return result;
      },
    };
  } catch (err) {
    console.error('Erro ao localizar a conta:', err);
    return undefined;
  }
}
