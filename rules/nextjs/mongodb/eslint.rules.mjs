// ─── MongoDB: Domain banned packages ───
export const mongodbDomainBannedPackages = ['mongodb', 'mongodb/**'];

// ─── MongoDB: Boundary elements ───
export const mongodbBoundaryElements = [
  { type: 'db', pattern: ['src/lib/db'] },
];

// ─── MongoDB: Boundary rules ───
export const mongodbBoundaryRules = [
  // DB — pure TS + mongodb driver only (no element imports)
  { from: { type: 'db' }, allow: [] },
];

// ─── MongoDB: Additional allow rules (patch into base rules) ───
// Repository can access db
export const mongodbBoundaryAllowPatches = [
  { from: 'api-repository', allow: { to: { type: 'db' } } },
];
