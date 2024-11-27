/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export const CORE_FLAGS = {
  skipResolveTypesInElementSource: 'SKIP_RESOLVE_TYPES_IN_ELEMENT_SOURCE',
  autoMergeListsDisabled: 'AUTO_MERGE_LISTS_DISABLE',
  dumpStateWithLegacyFormat: 'DUMP_STATE_WITH_LEGACY_FORMAT',
  failPlanOnCircularDependencies: 'FAIL_PLAN_ON_CIRCULAR_DEPENDENCY',
} as const
