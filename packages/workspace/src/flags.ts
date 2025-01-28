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
  createFilenamesToElementIdsMapping: 'CREATE_FILENAMES_TO_ELEMENT_IDS_MAPPING',
  useSplitSourceMapInUpdate: 'USE_SPLIT_SOURCE_MAP_IN_UPDATE',
  // Killswitch for the new fetch diff computation logic. Activating this restores the old logic.
  // TODO(SALTO-6992): Remove this killswitch after 2025-01-30
  computePlanOnFetch: 'COMPUTE_PLAN_ON_FETCH',
  skipStaticFilesCacheUpdate: 'SKIP_STATIC_FILES_CACHE_UPDATE',
} as const
