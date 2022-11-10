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
  BuiltinTypes,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import filterCreator, { GUIDE_TRANSLATION_FIELD } from '../../src/filters/guide_language_translations'
import { createFilterCreatorParams } from '../utils'
import { ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, SECTION_TRANSLATION_TYPE_NAME } from '../../src/constants'

describe('guid language settings filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, SECTION_TRANSLATION_TYPE_NAME) }
  )
  const guideLanguageSettingsType = new ObjectType(
    { elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) }
  )
  const sectionTranslationAfterFetchType = new ObjectType(
    { elemID: new ElemID(ZENDESK, SECTION_TRANSLATION_TYPE_NAME) }
  )
  sectionTranslationAfterFetchType.fields[GUIDE_TRANSLATION_FIELD] = new Field(
    sectionTranslationAfterFetchType,
    GUIDE_TRANSLATION_FIELD,
    BuiltinTypes.STRING,
  )
  const SectionTranslationInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: 'he',
      brand: 123,
    }
  )
  const guideLanguageSettingsInstance = new InstanceElement(
    'instance',
    guideLanguageSettingsType,
    {
      locale: 'he',
      brand: 123,
      name: 'bla',
    }
  )


  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add guide_translation field', async () => {
      const SectionTranslationAfterFetchInstance = new InstanceElement(
        'instance',
        sectionTranslationType,
        {
          locale: 'he',
          brand: 123,
          [GUIDE_TRANSLATION_FIELD]: new ReferenceExpression(
            guideLanguageSettingsInstance.elemID,
            guideLanguageSettingsInstance,
          ),
        }
      )

      const sectionTranslationInstanceCopy = SectionTranslationInstance.clone()
      const sectionTranslationTypeCopy = sectionTranslationType.clone()
      await filter.onFetch([
        sectionTranslationInstanceCopy,
        sectionTranslationTypeCopy,
        guideLanguageSettingsInstance,
      ])
      expect(sectionTranslationInstanceCopy).toEqual(SectionTranslationAfterFetchInstance)
      expect(sectionTranslationTypeCopy).toEqual(sectionTranslationAfterFetchType)
    })
    it('should add undefined in guide_translation field if the correct guide_language_settings does not exist', async () => {
      const SectionTranslationAfterFetchInstance = new InstanceElement(
        'instance',
        sectionTranslationType,
        {
          locale: 'he',
          brand: 123,
          [GUIDE_TRANSLATION_FIELD]: undefined,
        },
      )
      const guideLanguageSettingsDifferentBrandInstance = new InstanceElement(
        'instance',
        guideLanguageSettingsType,
        {
          locale: 'he',
          brand: 456,
          name: 'bla',
        }
      )
      const sectionTranslationInstanceCopy = SectionTranslationInstance.clone()
      const sectionTranslationTypeCopy = sectionTranslationType.clone()
      await filter.onFetch([
        sectionTranslationInstanceCopy,
        guideLanguageSettingsDifferentBrandInstance,
        sectionTranslationTypeCopy,
      ])
      expect(sectionTranslationInstanceCopy).toEqual(SectionTranslationAfterFetchInstance)
      expect(sectionTranslationTypeCopy).toEqual(sectionTranslationAfterFetchType)
    })
  })
})
