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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/guide_translation'
import { createFilterCreatorParams } from '../utils'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { removedTranslationParentId } from '../../src/filters/guide_section_and_category'

describe('guild section translation filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
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

  const heSectionTranslationInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: 'he',
      title: 'name',
      body: 'description',
    }
  )
  const enSectionTranslationInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: 'en',
      title: 'name',
      body: 'description',
    }
  )

  const sectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      id: 1,
      name: 'name',
      description: 'description',
      source_locale: new ReferenceExpression(
        guideLanguageSettingsType.elemID.createNestedID('instance', 'Test1'), guideLanguageSettingsInstance
      ),
      translations: [
        heSectionTranslationInstance.value,
        enSectionTranslationInstance.value,
      ],
    }
  )

  heSectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [sectionInstance.value]
  enSectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [sectionInstance.value]

  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should consider only added default translation in appliedChanges', async () => {
      const res = await filter.deploy([
        { action: 'add', data: { after: heSectionTranslationInstance } },
        { action: 'add', data: { after: enSectionTranslationInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: heSectionTranslationInstance } }])
    })
    it('should not consider modified default translation in appliedChanges', async () => {
      const res = await filter.deploy([
        { action: 'modify', data: { before: heSectionTranslationInstance, after: heSectionTranslationInstance } },
        { action: 'modify', data: { before: enSectionTranslationInstance, after: enSectionTranslationInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(2)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should consider removed translation if their parent section was removed in appliedChanges', async () => {
      removedTranslationParentId.push(sectionInstance.value.id)
      const res = await filter.deploy([
        { action: 'remove', data: { before: heSectionTranslationInstance } },
        { action: 'modify', data: { before: enSectionTranslationInstance, after: enSectionTranslationInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          { action: 'remove', data: { before: heSectionTranslationInstance } },
          { action: 'modify', data: { before: enSectionTranslationInstance, after: enSectionTranslationInstance } },
        ])
    })
  })
})
