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

import { client as clientUtils,
  filterUtils,
  elements as elementUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/help_center_section_translation'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import { ZENDESK } from '../../src/constants'

describe('custom field option restriction filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionTranslationTypename = 'section_translation'
  const helpCenterLocaleTypename = 'help_center_locale'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, sectionTranslationTypename) }
  )
  const helpCenterLocaleType = new ObjectType(
    { elemID: new ElemID(ZENDESK, helpCenterLocaleTypename) }
  )


  const helpCenterLocaleInstance = new InstanceElement(
    'instance',
    helpCenterLocaleType,
    {
      id: 'he',
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
      name: 'name',
      description: 'description',
      source_locale: new ReferenceExpression(
        helpCenterLocaleType.elemID.createNestedID('instance', 'Test1'), helpCenterLocaleInstance
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
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
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
  })
})
