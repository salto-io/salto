/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'

const { isDefined } = lowerdashValues
const FETCH_CONFIG = 'fetch'
const CLIENT_CONFIG = 'client'

export const TYPE_TO_EXCLUDE = 'typeToExclude'
const DISABLE_PRIVATE_API = 'disablePrivateAPI'
type ConfigSuggestionType = 'typeToExclude' | 'disablePrivateAPI' | 'enableFetchFlag'

export type ConfigChangeSuggestion = {
  type: ConfigSuggestionType
  value?: string
  reason: string
}

/**
 * Update config with types to exclude or disabling private API according to config changes
 */
export const getUpdatedConfigFromConfigChanges = ({
  configChanges,
  currentConfig,
  configType,
}: {
  configChanges: ConfigChangeSuggestion[]
  currentConfig: InstanceElement
  configType: ObjectType
}): { config: InstanceElement[]; message: string } | undefined => {
  if (configChanges.length === 0) {
    return undefined
  }

  const typesToExclude = configChanges
    .filter(configChange => configChange.type === TYPE_TO_EXCLUDE)
    .map(configChange => configChange.value)
    .filter(isDefined)

  const shouldDisablePrivateApi = configChanges.find(configChange => configChange.type === DISABLE_PRIVATE_API)

  const fetchFlagsToEnable = configChanges
    .filter(configChange => configChange.type === 'enableFetchFlag')
    .map(configChange => configChange.value)
    .filter(isDefined)

  const updatedFetchConfig = {
    ...currentConfig.value[FETCH_CONFIG],
    exclude: [
      ...currentConfig.value[FETCH_CONFIG].exclude,
      ...Object.values(typesToExclude.map(typeName => ({ type: typeName }))),
    ],
    ...Object.fromEntries(fetchFlagsToEnable.map(flagName => [[flagName], true])),
  }

  const updatedClientConfig = shouldDisablePrivateApi
    ? { ...currentConfig.value[CLIENT_CONFIG], usePrivateAPI: false }
    : currentConfig.value[CLIENT_CONFIG]

  return {
    config: [
      new InstanceElement(ElemID.CONFIG_NAME, configType, {
        ...currentConfig.value,
        fetch: updatedFetchConfig,
        client: updatedClientConfig,
      }),
    ],
    message: formatConfigSuggestionsReasons(configChanges.map(configChange => configChange.reason)),
  }
}
