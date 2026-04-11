import { KoaContextWithOIDC } from 'oidc-provider';
import { db } from '../adapter';
import { schema } from '../db';
import { eq } from 'drizzle-orm';

const { users } = schema;

/**
 * Localiza a conta associada ao `sub` informado.
 * O `sub` é o identificador canônico do usuário no OIDC.
 */
export async function findAccount(
  ctx: KoaContextWithOIDC,
  sub: string,
  token?: any
): Promise<undefined | { accountId: string; async: any; claims: (...args: any[]) => any }> {
  try {
    const result = await db.select().from(users).where(eq(users.sub, sub)).limit(1);
    const user = result[0];

    if (!user) {
      return undefined;
    }

    return {
      accountId: user.sub,
      async: () => {
        return {
          sub: user.sub,
          email: user.email,
          email_verified: user.emailVerified,
          name: user.name || user.email,
        };
      },
      claims: (...scopes: string[]) => {
        const claims: any = {
          sub: user.sub,
        };

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
    console.error('Erro ao localizar a conta:', err);
    return undefined;
  }
}
