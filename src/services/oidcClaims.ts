export interface CanonicalRoleClaims {
  global: string[];
  client: Array<{
    code: string;
    clientId: string;
  }>;
}

export interface RoleSource {
  code: string;
  scopeType: 'GLOBAL' | 'CLIENT';
  clientId: string | null;
}

export function buildCanonicalRoleClaims(
  userRoles: RoleSource[],
  requestedClientId: string | null,
): CanonicalRoleClaims {
  const global = userRoles
    .filter((role) => role.scopeType === 'GLOBAL')
    .map((role) => role.code);

  const client = userRoles
    .filter((role) => role.scopeType === 'CLIENT')
    .filter((role) => requestedClientId !== null && role.clientId === requestedClientId)
    .map((role) => ({
      code: role.code,
      clientId: role.clientId as string,
    }));

  return {
    global,
    client,
  };
}

export function summarizeCanonicalRoleClaims(roleClaims: CanonicalRoleClaims) {
  return {
    globalCount: roleClaims.global.length,
    clientCount: roleClaims.client.length,
    globalCodes: roleClaims.global,
    clientRoles: roleClaims.client,
  };
}
