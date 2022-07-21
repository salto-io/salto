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
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/omit_inactive'
import { FilterResult } from '../../src/filter'

describe('omit inactive', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch', FilterResult>
  let filter: FilterType
  const objType1 = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'trigger') })
  const objType2 = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'view') })
  const objType3 = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'macro') })
  const webhookObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'webhook') })
  const inst1 = new InstanceElement('inst1', objType1, { name: 'test', active: true })
  const inst2 = new InstanceElement('inst2', objType1, { name: 'test', active: false })
  const inst3 = new InstanceElement('inst1', objType2, { name: 'test', active: false })
  const inst4 = new InstanceElement('inst1', objType3, { name: 'test', active: false })
  const inst5 = new InstanceElement('inst2', objType3, { name: 'test', active: true })
  const webhook1 = new InstanceElement('inst1', webhookObjType, { name: 'test', status: 'active' })
  const webhook2 = new InstanceElement('inst2', webhookObjType, { name: 'test', status: 'inactive' })
  const webhook3 = new InstanceElement('inst3', webhookObjType, { name: 'test' })

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
      config: {
        ...DEFAULT_CONFIG,
        [API_DEFINITIONS_CONFIG]: {
          ...DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
          types: {
            trigger: {
              transformation: {
                omitInactive: true,
              },
            },
            macro: {
              transformation: {
                omitInactive: true,
              },
            },
            webhook: {
              transformation: {
                omitInactive: true,
              },
            },
            ticket_form: {
              transformation: {
                omitInactive: true,
              },
            },
          },
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should omit inactive instances if the omitInactive is true', async () => {
      const elements = [inst1, inst2, inst3, inst4, inst5, webhook1, webhook2, webhook3]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.getFullName()))
        .toEqual([
          inst1.elemID.getFullName(),
          inst3.elemID.getFullName(),
          inst5.elemID.getFullName(),
          webhook1.elemID.getFullName(),
          webhook3.elemID.getFullName(),
        ])
    })
    it('should omit inactive webhooks', async () => {
      const elements = [inst1, inst2, inst3, inst4, inst5]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.getFullName()))
        .toEqual([
          inst1.elemID.getFullName(),
          inst3.elemID.getFullName(),
          inst5.elemID.getFullName(),
        ])
    })
    it('should not omit instance if it does not have active field', async () => {
      const inst = new InstanceElement('inst1', objType1, { name: 'test' })
      const elements = [inst]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.getFullName()))
        .toEqual([inst.elemID.getFullName()])
    })
    it('should omit only the inactive instance if two instances have the same id', async () => {
      const activeInst = new InstanceElement('inst1', objType1, { name: 'test', active: true })
      const inactiveInst = new InstanceElement('inst1', objType1, { name: 'test', active: false })
      const elements = [activeInst, inactiveInst]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.getFullName()))
        .toEqual([activeInst.elemID.getFullName()])
    })
    it('should not omit instance of types that we need their inactive instances for reorder', async () => {
      const ticketFormObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_form') })
      const ticketForm = new InstanceElement('inst1', ticketFormObjType, { name: 'test', active: false })
      const elements = [ticketForm]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.getFullName()))
        .toEqual([ticketForm.elemID.getFullName()])
    })
  })
})
