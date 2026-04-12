// ─── NextAuth: Domain banned packages ───
export const nextauthDomainBannedPackages = ['next-auth', 'next-auth/**'];

// ─── NextAuth: Boundary elements ───
export const nextauthBoundaryElements = [
  { type: 'auth', mode: 'full', pattern: ['src/auth.ts'] },
];

// ─── NextAuth: Boundary rules ───
export const nextauthBoundaryRules = [
  // Auth — can access api-helper only
  { from: { type: 'auth' }, allow: [{ to: { type: 'api-helper' } }] },
];

// ─── NextAuth: Additional allow rules (patch into base rules) ───
// api-helper can access auth, page can access auth
export const nextauthBoundaryAllowPatches = [
  { from: 'api-helper', allow: { to: { type: 'auth' } } },
  { from: 'page', allow: { to: { type: 'auth' } } },
];
