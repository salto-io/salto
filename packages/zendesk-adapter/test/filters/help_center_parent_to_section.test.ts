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

import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType, ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/help_center_parent_to_section'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import { ZENDESK } from '../../src/constants'

describe('guid section filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })

  const InnerSectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      parent_section_id: 123,
      direct_parent: 456,
      parent_type: 'section',
    }
  )
  const OuterSectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      category_id: 789,
      id: 456,
      direct_parent: 789,
      parent_type: 'category',
    }
  )


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

  describe('preDeploy', () => {
    it('should remove name and description fields before deploy', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      sectionInstance.value.name = sectionTranslationInstance.value.title
      sectionInstance.value.description = sectionTranslationInstance.value.body
      expect(sectionInstanceCopy).toEqual(sectionInstance)
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
  })
})
