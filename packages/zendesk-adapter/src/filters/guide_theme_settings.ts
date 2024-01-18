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
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  ObjectType,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { naclCase } from '@salto-io/adapter-utils'
import { FETCH_CONFIG, isGuideEnabled, isGuideThemesEnabled, ZendeskConfig } from '../config'
import {
  GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK,
} from '../constants'
import { FilterCreator } from '../filter'
import { publish } from './guide_themes/publish'

const log = logger(module)


const createThemeSettingsInstances = (guideThemes: InstanceElement[], config: ZendeskConfig): Element[] => {
  const themeSettingsType = new ObjectType(
    {
      elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME),
      fields: {
        brand: { refType: BuiltinTypes.NUMBER },
        liveTheme: { refType: BuiltinTypes.STRING },
      },
      path: [ZENDESK, elementsUtils.TYPES_PATH, THEME_SETTINGS_TYPE_NAME],
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: config[FETCH_CONFIG].hideTypes ?? true,
      },
    },
  )

  const guideThemeSettingsInstances = Object.values(
    _.groupBy(
      guideThemes.filter(theme => isReferenceExpression(theme.value.brand_id)),
      theme => theme.value.brand_id.elemID.getFullName()
    )
  ).map(themes => {
    const brand = themes[0].value.brand_id
    const brandName = brand.value.value.name
    const liveThemes = themes.filter(theme => theme.value.live)
    if (liveThemes.length > 1) {
      log.warn(`Found ${liveThemes.length} live themes for brand ${brandName}, using the first one`)
    }
    if (liveThemes.length === 0) {
      log.warn(`Found no live themes for brand ${brandName}`)
      return undefined
    }
    const liveTheme = liveThemes[0]
    return new InstanceElement(
      naclCase(`${brandName}_settings`),
      themeSettingsType,
      {
        brand: new ReferenceExpression(brand.elemID),
        liveTheme: new ReferenceExpression(liveTheme.elemID),
      },
    )
  }).filter(values.isDefined)
  if (guideThemeSettingsInstances.length === 0) {
    return []
  }
  return [themeSettingsType, ...guideThemeSettingsInstances]
}

/**
 * Fetches and deploys guide theme settings
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'guideThemesSettingsFilter',
  onFetch: async elements => {
    if (!isGuideEnabled(config[FETCH_CONFIG]) || !isGuideThemesEnabled(config[FETCH_CONFIG])) {
      return undefined
    }

    const instances = elements.filter(isInstanceElement)
    const guideThemes = instances.filter(instance => instance.elemID.typeName === GUIDE_THEME_TYPE_NAME)
    elements.push(...createThemeSettingsInstances(guideThemes, config))
    return undefined
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [themeSettingsChanges, leftoverChanges] = _.partition(
      changes,
      change => THEME_SETTINGS_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    const [modificationChanges, otherChanges] = _.partition(themeSettingsChanges, isModificationChange)
    const processedModificationChanges = await Promise.all(modificationChanges.map(async change => {
      const themeId = getChangeData(change).value.liveTheme
      const publishErrors = await publish(themeId, client)
      if (publishErrors.length > 0) {
        return {
          errors: publishErrors.map(e => ({
            elemID: getChangeData(change).elemID,
            message: e,
            severity: 'Error' as SeverityLevel,
          })),
        }
      }
      return { appliedChange: change, errors: [] }
    }))
    const errorsOtherChanges = otherChanges.map(change => ({
      elemID: getChangeData(change).elemID,
      message: 'Non modification changes are not supported',
      severity: 'Error' as SeverityLevel,
    }))
    const errors = processedModificationChanges.flatMap(change => change.errors)
    const appliedChanges = processedModificationChanges.map(change => change.appliedChange).filter(values.isDefined)
    return { deployResult: { appliedChanges, errors: errors.concat(errorsOtherChanges) }, leftoverChanges }
  },
})
export default filterCreator
