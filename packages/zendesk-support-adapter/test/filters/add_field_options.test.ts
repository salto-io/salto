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
import {
  ObjectType, ElemID, InstanceElement, toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/add_field_options'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME, ORG_FIELD_TYPE_NAME } from '../../src/filters/organization_field'
import { USER_FIELD_TYPE_NAME } from '../../src/filters/custom_field_options/user_field'

describe('add field options filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType

  beforeEach(async () => {
    jest.clearAllMocks()
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
    it.each([USER_FIELD_TYPE_NAME, ORG_FIELD_TYPE_NAME])('should add null as id for new childs of %s', async fieldTypeName => {
      const resolvedParent = new InstanceElement(
        'parent',
        new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, fieldTypeName) }),
        {
          id: 11,
          name: 'parent',
          [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
            { id: 22, name: 'child1', value: 'v1' },
          ],
        },
      )
      const clonedResolvedParentBefore = resolvedParent.clone()
      const clonedResolvedParentAfter = resolvedParent.clone()
      clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        { id: 22, name: 'child1', value: 'v1' },
        { name: 'child2', value: 'v2' },
      ]
      const change = toChange({
        before: clonedResolvedParentBefore, after: clonedResolvedParentAfter,
      })
      await filter?.preDeploy([change])
      expect(clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'child1', value: 'v1' },
        { id: null, name: 'child2', value: 'v2' },
      ])
    })
  })
  describe('onDeploy', () => {
    it.each([USER_FIELD_TYPE_NAME, ORG_FIELD_TYPE_NAME])('should remove the null from id for new childs of %s', async fieldTypeName => {
      const resolvedParent = new InstanceElement(
        'parent',
        new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, fieldTypeName) }),
        {
          id: 11,
          name: 'parent',
          [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
            { id: 22, name: 'child1', value: 'v1' },
          ],
        },
      )
      const clonedResolvedParentBefore = resolvedParent.clone()
      const clonedResolvedParentAfter = resolvedParent.clone()
      clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        { id: 22, name: 'child1', value: 'v1' },
        { id: null, name: 'child2', value: 'v2' },
      ]
      const change = toChange({
        before: clonedResolvedParentBefore, after: clonedResolvedParentAfter,
      })
      await filter?.onDeploy([change])
      expect(clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'child1', value: 'v1' },
        { name: 'child2', value: 'v2' },
      ])
    })
  })
})
