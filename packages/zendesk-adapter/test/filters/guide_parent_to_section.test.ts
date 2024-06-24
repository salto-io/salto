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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/guide_parent_to_section'
import { ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { FilterResult } from '../../src/filter'

describe('guid section filter', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'deploy' | 'onDeploy', FilterResult>
  let filter: FilterType
  let client: ZendeskClient
  let mockPut: jest.SpyInstance

  const sectionTypeName = 'section'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })

  const InnerSectionInstance = new InstanceElement('instance', sectionType, {
    parent_section_id: 123,
    direct_parent_id: 123,
    direct_parent_type: 'section',
  })
  const OuterSectionInstance = new InstanceElement('instance', sectionType, {
    category_id: 789,
    id: 123,
    direct_parent_id: 789,
    direct_parent_type: 'category',
  })

  const InnerSectionInstanceNoFields = new InstanceElement('instance', sectionType, {
    parent_section_id: 123,
  })
  const OuterSectionInstanceNoFields = new InstanceElement('instance', sectionType, {
    category_id: 789,
    id: 123,
  })

  const guideLanguageSettingsInstance = new InstanceElement(
    'instance',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'section_translation') }),
    {
      locale: 'he',
    },
  )
  const sectionTranslationInstance = new InstanceElement(
    'instance',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'section_translation') }),
    {
      locale: new ReferenceExpression(guideLanguageSettingsInstance.elemID, guideLanguageSettingsInstance),
      title: 'name',
      body: 'description',
    },
  )
  const sectionInstance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(ZENDESK, 'section') }), {
    source_locale: 'he',
    translations: [sectionTranslationInstance.value],
    id: 1111,
  })

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })

    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('preDeploy', () => {
    it('should remove direct_parent_id and direct_parent_type fields before deploy', async () => {
      const InnerSectionInstanceCopy = InnerSectionInstance.clone()
      const OuterSectionInstanceCopy = OuterSectionInstance.clone()
      await filter.preDeploy([
        toChange({ after: InnerSectionInstanceCopy }),
        toChange({ after: OuterSectionInstanceCopy }),
      ])
      expect(InnerSectionInstanceCopy).toEqual(InnerSectionInstanceNoFields)
      expect(OuterSectionInstanceCopy).toEqual(OuterSectionInstanceNoFields)
    })
  })
  describe('deploy', () => {
    beforeEach(() => {
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockImplementation(params => {
        if (['/api/v2/help_center/sections/1111/source_locale'].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
    })
    it('should send a separate request when updating default_locale', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      sectionInstanceCopy.value.source_locale = 'ar'
      await filter.deploy([{ action: 'modify', data: { before: sectionInstance, after: sectionInstanceCopy } }])
      expect(mockPut).toHaveBeenCalledTimes(2)
    })
  })

  describe('onDeploy', () => {
    it('should remove direct_parent_id and direct_parent_type fields after deploy', async () => {
      const InnerSectionInstanceCopy = InnerSectionInstance.clone()
      const OuterSectionInstanceCopy = OuterSectionInstance.clone()
      await filter.preDeploy([
        toChange({ after: InnerSectionInstanceCopy }),
        toChange({ after: OuterSectionInstanceCopy }),
      ])
      await filter.onDeploy([
        toChange({ after: InnerSectionInstanceCopy }),
        toChange({ after: OuterSectionInstanceCopy }),
      ])
      expect(InnerSectionInstanceCopy).toEqual(InnerSectionInstance)
      expect(OuterSectionInstanceCopy).toEqual(OuterSectionInstance)
    })
  })
})
