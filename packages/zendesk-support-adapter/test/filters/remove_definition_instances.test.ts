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
import { ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
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
    }) as FilterType
  })

  describe('onFetch', () => {
    // NOTE: We disabled this test in order to debug SALTO-2202
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should remove the instances of the relevant types', async () => {
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
    // NOTE: Should be removed once we finish to debug SALTO-2202
    it('should change the hidden value annotation of the relevant types', async () => {
      const elements = [
        randomObjType, instanceRandomObj, triggerDefinitionObjType, macrosActionsObjType,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        'zendesk_support.obj',
        'zendesk_support.obj.instance.test',
        'zendesk_support.trigger_definition',
        'zendesk_support.macros_actions',
      ])
      expect(triggerDefinitionObjType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toEqual(true)
      expect(macrosActionsObjType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toEqual(true)
    })
  })
})
