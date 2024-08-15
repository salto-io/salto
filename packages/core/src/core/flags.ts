/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'

export const CORE_FLAG_PREFIX = 'SALTO_'

export const CORE_FLAGS = {
  skipResolveTypesInElementSource: 'SKIP_RESOLVE_TYPES_IN_ELEMENT_SOURCE',
  autoMergeDisabled: 'AUTO_MERGE_DISABLE',
} as const

type CoreFlagName = types.ValueOf<typeof CORE_FLAGS>

export const getCoreFlag = (flagName: CoreFlagName): string | undefined => process.env[CORE_FLAG_PREFIX + flagName]

export const getCoreFlagBool = (flagName: CoreFlagName): boolean => {
  const flagValue = getCoreFlag(flagName)
  let parsedFlagValue: unknown
  try {
    parsedFlagValue = flagValue === undefined ? undefined : JSON.parse(flagValue)
  } catch (e) {
    parsedFlagValue = flagValue
  }
  return Boolean(parsedFlagValue)
}
