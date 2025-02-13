/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ConfigCreator,
  ElemID,
  InstanceElement,
  ObjectType,
  createRestriction,
} from '@salto-io/adapter-api'
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
  createOptionsTypeGuard,
} from '@salto-io/adapter-utils'
import { ENABLE_DEPLOY_SUPPORT_FLAG, configType } from './user_config'
import { WORKATO } from './constants'

const optionsElemId = new ElemID(WORKATO, 'configOptionsType')

const WORKATO_DEPLOY_OPTION = 'Deploy'
const WORKATO_IMPACT_ANALYSIS_OPTION = 'Impact Analysis'

type ConfigOptionsType = {
  useCase?: string
}

export const optionsType = (): ObjectType =>
  createMatchingObjectType<ConfigOptionsType>({
    elemID: optionsElemId,
    fields: {
      useCase: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.DEFAULT]: WORKATO_DEPLOY_OPTION,
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [CORE_ANNOTATIONS.ALIAS]: 'Choose your Workato use case',
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: [WORKATO_DEPLOY_OPTION, WORKATO_IMPACT_ANALYSIS_OPTION],
            enforce_value: true,
          }),
          [CORE_ANNOTATIONS.DESCRIPTION]: `## Customize Your Workato Use Case

### Deploy
Deploy recipes and move changes between environments.
        
This mode does not support connecting additional applications to Workato.
        
### Impact Analysis
Connect Workato to additional applications such as Salesforce, Netsuite, Jira, and more to analyze dependencies between your Workato recipes and these applications.
        
[Learn more about this feature](https://help.salto.io/en/articles/6933980-salto-for-workato-overview#h_c14c3e1e79).
        
This mode does not support deploying changes.`,
        },
      },
    },
  })

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  const defaultConfig = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options === undefined || !createOptionsTypeGuard<ConfigOptionsType>(optionsElemId)(options)) {
    return defaultConfig
  }
  if (options.value.useCase !== undefined) {
    const clonedConfig = defaultConfig.clone()
    // fallback to enable deploy support
    clonedConfig.value[ENABLE_DEPLOY_SUPPORT_FLAG] = options.value.useCase !== WORKATO_IMPACT_ANALYSIS_OPTION
    return clonedConfig
  }
  return defaultConfig
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
