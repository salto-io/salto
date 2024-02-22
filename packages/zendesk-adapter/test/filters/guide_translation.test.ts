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

import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/guide_translation'
import { createFilterCreatorParams } from '../utils'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { removedTranslationParentId } from '../../src/filters/guide_section_and_category'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('guide translation filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionTranslationTypename = 'section_translation'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
  const sectionTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTranslationTypename) })
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })
  const articleTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME) })
  const guideLanguageSettingsType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME),
  })

  const guideLanguageSettingsInstance = new InstanceElement('test1', guideLanguageSettingsType, {
    locale: 'he',
  })

  const heArticleTranslationInstance = new InstanceElement('instance', articleTranslationType, {
    locale: 'he',
    title: 'name',
    body: 'description',
  })
  const heSectionTranslationInstance = new InstanceElement('instance', sectionTranslationType, {
    locale: 'he',
    title: 'name',
    body: 'description',
  })
  const enSectionTranslationInstance = new InstanceElement('instance', sectionTranslationType, {
    locale: 'en',
    title: 'name',
    body: 'description',
  })
  const articleInstance = new InstanceElement('instance', articleType, {
    id: 2,
    source_locale: new ReferenceExpression(guideLanguageSettingsInstance.elemID, guideLanguageSettingsInstance),
    translations: [heArticleTranslationInstance.value],
  })

  heArticleTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [articleInstance.value]

  const sectionInstance = new InstanceElement('instance', sectionType, {
    id: 1,
    name: 'name',
    description: 'description',
    source_locale: new ReferenceExpression(guideLanguageSettingsInstance.elemID, guideLanguageSettingsInstance),
    translations: [heSectionTranslationInstance.value, enSectionTranslationInstance.value],
  })

  heSectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [sectionInstance.value]
  enSectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [sectionInstance.value]

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(
      createFilterCreatorParams({
        elementsSource: buildElementsSourceFromElements([guideLanguageSettingsInstance]),
      }),
    ) as FilterType
  })

  describe('deploy', () => {
    it('should deploy added default article translation as modification', async () => {
      mockDeployChange.mockImplementation(async () => ({ translation: { id: 3 } }))
      const res = await filter.deploy([{ action: 'add', data: { after: heArticleTranslationInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: {
          action: 'modify',
          data: { before: heArticleTranslationInstance, after: heArticleTranslationInstance },
        },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'add', data: { after: heArticleTranslationInstance } },
      ])
    })
    it('should not deploy added default article translation if there is an error', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: heArticleTranslationInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: {
          action: 'modify',
          data: { before: heArticleTranslationInstance, after: heArticleTranslationInstance },
        },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should consider only added default translation in appliedChanges', async () => {
      const res = await filter.deploy([
        { action: 'add', data: { after: heSectionTranslationInstance } },
        { action: 'add', data: { after: enSectionTranslationInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'add', data: { after: heSectionTranslationInstance } },
      ])
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
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'remove', data: { before: heSectionTranslationInstance } },
        { action: 'modify', data: { before: enSectionTranslationInstance, after: enSectionTranslationInstance } },
      ])
    })
  })
})
