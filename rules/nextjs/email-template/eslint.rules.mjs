// ─── Email Template: Boundary elements ───
export const emailTemplateBoundaryElements = [
  { type: 'email-template', pattern: ['src/lib/email-templates'] },
];

// ─── Email Template: Boundary rules ───
export const emailTemplateBoundaryRules = [
  // Email Template — may access dictionaries for i18n
  {
    from: { type: 'email-template' },
    allow: [{ to: { type: 'dictionary' } }, { to: { type: 'shared-type' } }],
  },
];

// ─── Email Template: Additional allow rules (patch into base rules) ───
// api-helper can access email-template
export const emailTemplateBoundaryAllowPatches = [
  { from: 'api-helper', allow: { to: { type: 'email-template' } } },
];
