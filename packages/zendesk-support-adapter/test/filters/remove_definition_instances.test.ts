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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/remove_definition_instances'
import { FilterResult } from '../../src/filter'

describe('remove definition instances', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch', FilterResult>
  let filter: FilterType
  const randomObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'obj') })
  const instanceRandomObj = new InstanceElement('test', randomObjType)
  const triggerDefinitionObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'trigger_definition') })
  const triggerDefinition = new InstanceElement('test', triggerDefinitionObjType)
  const macrosActionsObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'macros_actions') })
  const macrosActions = new InstanceElement('test', macrosActionsObjType)

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

  describe('onFetch', () => {
    it('should change the hidden value annotation of the relevant types', async () => {
      const elements = [
        randomObjType, instanceRandomObj, triggerDefinitionObjType,
        triggerDefinition, macrosActionsObjType, macrosActions,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        'zendesk_support.obj',
        'zendesk_support.obj.instance.test',
        'zendesk_support.trigger_definition',
        'zendesk_support.macros_actions',
      ])
    })
  })
})
