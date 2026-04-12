import requireApiProperty from './require-api-property.mjs';
import dtoNamingConvention from './dto-naming-convention.mjs';
import requireTimestamptz from './require-timestamptz.mjs';
import requireMapDomainException from './require-map-domain-exception.mjs';
import dtoUnionTypeRestriction from './dto-union-type-restriction.mjs';

/** @type {import('eslint').ESLint.Plugin} */
export default {
  rules: {
    'require-api-property': requireApiProperty,
    'dto-naming-convention': dtoNamingConvention,
    'require-timestamptz': requireTimestamptz,
    'require-map-domain-exception': requireMapDomainException,
    'dto-union-type-restriction': dtoUnionTypeRestriction,
  },
};
