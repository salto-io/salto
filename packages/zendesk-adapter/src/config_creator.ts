/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  ConfigCreator,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
  createOptionsTypeGuard,
} from '@salto-io/adapter-utils'
import { configType } from './config'
import * as constants from './constants'
import { Themes } from './user_config'

const optionsElemId = new ElemID(constants.ZENDESK, 'configOptionsType')

const NO_GUIDE = 'No guide'
const GUIDE_WITHOUT_THEMES = 'Guide without Themes'
const GUIDE_WITH_THEMES = 'Guide with Themes'
const GUIDE_OPTIONS = [NO_GUIDE, GUIDE_WITHOUT_THEMES, GUIDE_WITH_THEMES] as const

type ConfigOptionsType = {
  enableGuide?: boolean
  enableGuideThemes?: boolean
  guideOptions?: string
}

export const optionsType = (): ObjectType =>
  createMatchingObjectType<ConfigOptionsType>({
    elemID: optionsElemId,
    fields: {
      enableGuide: { refType: BuiltinTypes.BOOLEAN },
      enableGuideThemes: { refType: BuiltinTypes.BOOLEAN },
      guideOptions: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: GUIDE_OPTIONS,
            enforce_value: true,
          }),
          [CORE_ANNOTATIONS.DESCRIPTION]:
            'Manage [Guide](https://help.salto.io/en/articles/6948736-salto-for-zendesk-guide) or [Guide Themes](https://help.salto.io/en/articles/9031533-fetching-zendesk-guide-themes) with Salto',
        },
      },
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
  const { enableGuide, enableGuideThemes, guideOptions } = options.value
  if (enableGuide === true || enableGuideThemes === true || (guideOptions && guideOptions !== NO_GUIDE)) {
    const configWithGuide = defaultConf.clone()
    const guideThemesOverride =
      enableGuideThemes === true || guideOptions === GUIDE_WITH_THEMES ? DEFAULT_GUIDE_THEME_CONFIG : {}
    configWithGuide.value.fetch = {
      ...configWithGuide.value.fetch,
      guide: { brands: ['.*'], ...guideThemesOverride },
    }
    return configWithGuide
  }
  return defaultConf
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
