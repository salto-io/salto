/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BuiltinTypes, ConfigCreator, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, createMatchingObjectType, isOptionsTypeInstance } from '@salto-io/adapter-utils'
import { ENABLE_DEPLOY_SUPPORT_FLAG, configType } from './config'
import { WORKATO } from './constants'

const optionsElemId = new ElemID(WORKATO, 'configOptionsType')

type ConfigOptionsType = {
  enableDeploy?: boolean
}
export const optionsType = createMatchingObjectType<ConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    enableDeploy: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  const defaultConfig = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options === undefined || !isOptionsTypeInstance<ConfigOptionsType>(options, optionsElemId)) {
    return defaultConfig
  }
  if (options.value.enableDeploy !== undefined) {
    const clonedConfig = defaultConfig.clone()
    clonedConfig.value[ENABLE_DEPLOY_SUPPORT_FLAG] = options.value.enableDeploy
    return clonedConfig
  }
  return defaultConfig
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
