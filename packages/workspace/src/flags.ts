/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export const SALTO_FLAG_PREFIX = 'SALTO_'

export const getSaltoFlag = (flagName: string): string | undefined => process.env[SALTO_FLAG_PREFIX + flagName]

export const getSaltoFlagBool = (flagName: string): boolean => {
  const flagValue = getSaltoFlag(flagName)
  let parsedFlagValue: unknown
  try {
    parsedFlagValue = flagValue === undefined ? undefined : JSON.parse(flagValue)
  } catch {
    parsedFlagValue = flagValue
  }
  return Boolean(parsedFlagValue)
}

export const WORKSPACE_FLAGS = {
  replaceGetPlanWithCalculateDiff: 'REPLACE_GET_PLAN_WITH_CALCULATE_DIFF',
  skipStaticFilesCacheUpdate: 'SKIP_STATIC_FILES_CACHE_UPDATE',
} as const
