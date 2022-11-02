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
  filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType,
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
      direct_parent_id: 123,
      direct_parent_type: 'section',
    }
  )
  const OuterSectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      category_id: 789,
      id: 123,
      direct_parent_id: 789,
      direct_parent_type: 'category',
    }
  )

  const InnerSectionInstanceNoFields = new InstanceElement(
    'instance',
    sectionType,
    {
      parent_section_id: 123,
    }
  )
  const OuterSectionInstanceNoFields = new InstanceElement(
    'instance',
    sectionType,
    {
      category_id: 789,
      id: 123,
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
