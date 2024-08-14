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
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
  createOptionsTypeGuard,
} from '@salto-io/adapter-utils'
import { configType } from './config/config'
import * as constants from './constants'

const optionsElemId = new ElemID(constants.JIRA, 'configOptionsType')

type ConfigOptionsType = {
  enableScriptRunnerAddon?: boolean
  enableJSM?: boolean
}

export const optionsType = createMatchingObjectType<ConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    enableScriptRunnerAddon: { refType: BuiltinTypes.BOOLEAN },
    enableJSM: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  const defaultConf = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options !== undefined && createOptionsTypeGuard<ConfigOptionsType>(optionsElemId)(options)) {
    if (options.value.enableScriptRunnerAddon) {
      defaultConf.value.fetch.enableScriptRunnerAddon = true
    }
    if (options.value.enableJSM) {
      defaultConf.value.fetch.enableJSM = true
    }
  }
  return defaultConf
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
