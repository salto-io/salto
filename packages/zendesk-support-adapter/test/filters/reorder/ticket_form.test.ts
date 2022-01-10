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
  ObjectType, ElemID, InstanceElement, Element, isObjectType,
  isInstanceElement, ReferenceExpression, ModificationChange,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../../src/config'
import ZendeskClient from '../../../src/client/client'
import { ZENDESK_SUPPORT } from '../../../src/constants'
import { paginate } from '../../../src/client/pagination'
import filterCreator from '../../../src/filters/reorder/ticket_form'
import { createOrderTypeName } from '../../../src/filters/reorder/creator'

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

describe('ticket form reorder filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  const typeName = 'ticket_form'
  const orderTypeName = createOrderTypeName(typeName)
  const objType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, typeName) })
  const inst1 = new InstanceElement('inst1', objType, { id: 11, position: 1, name: 'inst1' })
  const inst2 = new InstanceElement('inst2', objType, { id: 22, position: 2, name: 'inst2' })

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
    it('should create correct order element', async () => {
      const elements = [objType, inst1, inst2]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.ticket_form',
          'zendesk_support.ticket_form.instance.inst1',
          'zendesk_support.ticket_form.instance.inst2',
          'zendesk_support.ticket_form_order',
          'zendesk_support.ticket_form_order.instance',
        ])
      const ticketFormOrderType = elements
        .find(e => isObjectType(e) && e.elemID.typeName === orderTypeName)
      expect(ticketFormOrderType).toBeDefined()
      const ticketFormOrderInstance = elements
        .find(e => isInstanceElement(e) && e.elemID.typeName === orderTypeName)
      expect(ticketFormOrderInstance).toBeDefined()
      expect(ticketFormOrderInstance?.elemID.name).toEqual(ElemID.CONFIG_NAME)
      expect((ticketFormOrderInstance as InstanceElement)?.value)
        .toEqual({ ticket_form_ids: [
          new ReferenceExpression(inst1.elemID, inst1),
          new ReferenceExpression(inst2.elemID, inst2),
        ] })
    })
    it('should not create new elements if there are no ticket form', async () => {
      const elements: Element[] = []
      await filter.onFetch(elements)
      expect(elements).toHaveLength(0)
    })
  })
  describe('deploy', () => {
    const orderType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, orderTypeName) })
    const before = new InstanceElement(
      ElemID.CONFIG_NAME, orderType, { ticket_form_ids: [11, 22] },
    )
    const after = new InstanceElement(
      ElemID.CONFIG_NAME, orderType, { ticket_form_ids: [22, 11] },
    )
    const change: ModificationChange<InstanceElement> = {
      action: 'modify',
      data: { before, after },
    }
    it('should pass the correct params to deployChange', async () => {
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toEqual([change])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(change, expect.anything(), expect.anything())
    })
    it('should return an error if there are multiple order changes', async () => {
      const res = await filter.deploy([change, change])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
    })
    it('should return an error if the order change is not modification', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
    })
  })
})
