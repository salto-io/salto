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
import { createDefaultInstanceFromType, createMatchingObjectType, createOptionsTypeGuard } from '@salto-io/adapter-utils'
import { configType } from './config'
import * as constants from './constants'
import { Themes } from './user_config'

const optionsElemId = new ElemID(constants.ZENDESK, 'configOptionsType')

type ConfigOptionsType = {
  enableGuide?: boolean
  enableGuideThemes?: boolean
}
export const optionsType = createMatchingObjectType<ConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    enableGuide: { refType: BuiltinTypes.BOOLEAN },
    enableGuideThemes: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const DEFAULT_GUIDE_THEME_CONFIG: { themes: Themes } = {
  themes: {
    brands: ['.*'],
    referenceOptions: {
      enableReferenceLookup: true,
      javascriptReferenceLookupStrategy: {
        strategy: 'varNamePrefix',
        prefix: 'SALTO_REFERENCE',
      },
    },
  },
}

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  const defaultConf = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options === undefined || !createOptionsTypeGuard<ConfigOptionsType>(optionsElemId)(options)) {
    return defaultConf
  }
  if (options.value.enableGuide === true || options.value.enableGuideThemes === true) {
    const configWithGuide = defaultConf.clone()
    const guideOverride = options.value.enableGuide === true ? { brands: ['.*'] } : {}
    const guideThemesOverride = options.value.enableGuideThemes === true ? DEFAULT_GUIDE_THEME_CONFIG : {}
    configWithGuide.value.fetch = {
      ...configWithGuide.value.fetch,
      guide: { ...guideOverride, ...guideThemesOverride },
    }
    return configWithGuide
  }
  return defaultConf
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
