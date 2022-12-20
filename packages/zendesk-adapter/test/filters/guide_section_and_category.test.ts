/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { filterUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType, ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/guide_section_and_category'


import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

describe('guid section and category filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionTranslationTypename = 'section_translation'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, sectionTranslationTypename) }
  )
  const guideLanguageSettingsType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME),
  })

  const guideLanguageSettingsInstance = new InstanceElement(
    'instance',
    guideLanguageSettingsType,
    {
      locale: 'he',
    }
  )

  const sectionTranslationInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: new ReferenceExpression(guideLanguageSettingsInstance.elemID, guideLanguageSettingsInstance),
      title: 'name',
      body: 'description',
    }
  )
  const sectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      source_locale: 'he',
      translations: [
        sectionTranslationInstance.value,
      ],
    }
  )

  const sectionTranslationStringLocaleInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: 'he',
      title: 'name',
      body: 'description',
    }
  )

  const sectionInstanceStringLocale = new InstanceElement(
    'instance',
    sectionType,
    {
      source_locale: 'he',
      translations: [
        sectionTranslationStringLocaleInstance.value,
      ],
    }
  )


  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('preDeploy', () => {
    it('should add the name and description fields before deploy', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      sectionInstance.value.name = sectionTranslationInstance.value.title
      sectionInstance.value.description = sectionTranslationInstance.value.body
      expect(sectionInstanceCopy).toEqual(sectionInstance)
    })
    it('should add the name and description fields before deploy when locale is string', async () => {
      const sectionInstanceCopy = sectionInstanceStringLocale.clone()
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      sectionInstanceStringLocale.value.name = sectionTranslationStringLocaleInstance.value.title
      sectionInstanceStringLocale.value.description = sectionTranslationStringLocaleInstance.value.body
      expect(sectionInstanceCopy).toEqual(sectionInstanceStringLocale)
    })
  })

  describe('onDeploy', () => {
    it('should omit the name and description fields after deploy', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      await filter.onDeploy([toChange({ after: sectionInstanceCopy })])
      expect(sectionInstanceCopy.value).toEqual({
        source_locale: 'he',
        translations: [
          sectionTranslationInstance.value,
        ],
      })
    })
    it('should omit the name and description fields after deploy when locale is string', async () => {
      const sectionInstanceCopy = sectionInstanceStringLocale.clone()
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      await filter.onDeploy([toChange({ after: sectionInstanceCopy })])
      expect(sectionInstanceCopy.value).toEqual({
        source_locale: 'he',
        translations: [
          sectionTranslationStringLocaleInstance.value,
        ],
      })
    })
  })
})
