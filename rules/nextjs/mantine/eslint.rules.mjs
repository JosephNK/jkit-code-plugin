// ─── Mantine: Restricted import patterns ───
// Ban utility CSS frameworks and CSS-in-JS libraries (Mantine style props only)
export const mantineRestrictedPatterns = [
  {
    group: ['tailwindcss', 'tailwindcss/**', 'unocss', 'unocss/**', 'windicss', 'windicss/**'],
    message: 'Utility CSS frameworks are not allowed. Use Mantine style props.',
  },
  {
    group: ['@emotion/*', 'styled-components', 'styled-jsx', 'styled-jsx/**'],
    message: 'CSS-in-JS libraries are not allowed. Use Mantine style props or CSS Modules.',
  },
];

// ─── Mantine: Restricted syntax (no-restricted-syntax entries) ───
// Ban component="a" — must use next/link for internal navigation
export const mantineRestrictedSyntax = [
  {
    selector: "JSXAttribute[name.name='component'][value.value='a']",
    message:
      'Do not use component="a" for internal links — it causes full page reload. Use component={Link} from next/link instead.',
  },
];

// ─── Mantine: Domain banned packages ───
export const mantineDomainBannedPackages = ['@mantine/**'];
