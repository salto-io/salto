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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isObjectType,
  isInstanceElement,
  ReferenceExpression,
  ModificationChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { TRIGGER_CATEGORY_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../../../src/constants'
import filterCreator from '../../../src/filters/reorder/trigger'
import { createOrderTypeName } from '../../../src/filters/reorder/creator'
import { createFilterCreatorParams } from '../../utils'

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

describe('trigger reorder filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  const triggerTypeName = TRIGGER_TYPE_NAME
  const categoryTypeName = TRIGGER_CATEGORY_TYPE_NAME
  const orderTypeName = createOrderTypeName(triggerTypeName)
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, triggerTypeName) })
  const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, categoryTypeName) })
  const category1 = new InstanceElement('cate1', categoryType, { id: 1, position: 1, title: 'cate1' })
  const category2 = new InstanceElement('cate2', categoryType, { id: 2, position: 2, title: 'cate3' })
  const category3 = new InstanceElement('cate3', categoryType, { id: 3, position: 3, title: 'cate2' })
  const trigger1 = new InstanceElement('trigger1', triggerType, {
    id: 11,
    position: 1,
    title: 'trigger2',
    category_id: '1',
    active: true,
  })
  const trigger2 = new InstanceElement('trigger2', triggerType, {
    id: 22,
    position: 2,
    title: 'trigger1',
    category_id: '1',
    active: true,
  })
  const trigger3 = new InstanceElement('trigger3', triggerType, {
    id: 33,
    position: 2,
    title: 'aaa',
    category_id: '2',
    active: true,
  })
  const trigger4 = new InstanceElement('trigger4', triggerType, {
    id: 44,
    position: 2,
    title: 'bbb',
    category_id: '2',
    active: true,
  })
  const trigger5 = new InstanceElement('trigger5', triggerType, {
    id: 55,
    position: 1,
    title: 'a',
    category_id: '2',
    active: false,
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should create correct order element', async () => {
      const elements = [
        triggerType,
        categoryType,
        category1,
        category2,
        category3,
        trigger1,
        trigger2,
        trigger3,
        trigger4,
        trigger5,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.trigger',
        'zendesk.trigger.instance.trigger1',
        'zendesk.trigger.instance.trigger2',
        'zendesk.trigger.instance.trigger3',
        'zendesk.trigger.instance.trigger4',
        'zendesk.trigger.instance.trigger5',
        'zendesk.trigger_category',
        'zendesk.trigger_category.instance.cate1',
        'zendesk.trigger_category.instance.cate2',
        'zendesk.trigger_category.instance.cate3',
        'zendesk.trigger_order',
        'zendesk.trigger_order.instance',
        'zendesk.trigger_order_entry',
      ])
      const triggerOrderType = elements.find(e => isObjectType(e) && e.elemID.typeName === orderTypeName)
      expect(triggerOrderType).toBeDefined()
      const triggerOrderInstance = elements.find(e => isInstanceElement(e) && e.elemID.typeName === orderTypeName)
      expect(triggerOrderInstance).toBeDefined()
      expect(triggerOrderInstance?.elemID.name).toEqual(ElemID.CONFIG_NAME)
      expect((triggerOrderInstance as InstanceElement)?.value).toEqual({
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
              new ReferenceExpression(trigger2.elemID, trigger2),
            ],
            inactive: [],
          },
          {
            category: new ReferenceExpression(category2.elemID, category2),
            active: [
              new ReferenceExpression(trigger3.elemID, trigger3),
              new ReferenceExpression(trigger4.elemID, trigger4),
            ],
            inactive: [new ReferenceExpression(trigger5.elemID, trigger5)],
          },
          {
            category: new ReferenceExpression(category3.elemID, category3),
            active: [],
            inactive: [],
          },
        ],
      })
      const orderType = elements.find(elem => elem.elemID.getFullName() === 'zendesk.trigger_order')
      expect(orderType).toBeDefined()
    })
    it('should not create new elements if trigger type does not exist', async () => {
      const elements = [categoryType]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual(['zendesk.trigger_category'])
    })
    it('should not create new elements if trigger category type does not exist', async () => {
      const elements = [triggerType]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual(['zendesk.trigger'])
    })
  })
  describe('deploy', () => {
    const orderType = new ObjectType({ elemID: new ElemID(ZENDESK, orderTypeName) })
    const before = new InstanceElement(ElemID.CONFIG_NAME, orderType, {
      order: [
        { category: '1', active: [11, 22], inactive: [55, 66] },
        { category: '2', active: [33, 44], inactive: [] },
        { category: '3' },
      ],
    })
    const after = new InstanceElement(ElemID.CONFIG_NAME, orderType, {
      order: [
        { category: '2', active: [44, 33], inactive: [] },
        { category: '3', active: [], inactive: [] },
        { category: '1', active: [11, 22], inactive: [66, 55] },
      ],
    })
    const change: ModificationChange<InstanceElement> = {
      action: 'modify',
      data: { before, after },
    }
    it('should pass the correct params to deployChange', async () => {
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toEqual([change])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      const instanceToDeploy = after.clone()
      instanceToDeploy.value = {
        action: 'patch',
        items: {
          trigger_categories: [
            { id: '2', position: 1 },
            { id: '3', position: 2 },
            { id: '1', position: 3 },
          ],
          triggers: [
            { id: '44', position: 1, category_id: '2' },
            { id: '33', position: 2, category_id: '2' },
            { id: '11', position: 1, category_id: '1' },
            { id: '22', position: 2, category_id: '1' },
            { id: '66', position: 3, category_id: '1' },
            { id: '55', position: 4, category_id: '1' },
          ],
        },
      }
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: {
          action: 'modify',
          data: {
            after: instanceToDeploy,
            before,
          },
        },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
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
    it('should return an error if the order is in invalid format', async () => {
      const res = await filter.deploy([
        {
          action: 'modify',
          data: {
            before,
            after: new InstanceElement(ElemID.CONFIG_NAME, orderType, {
              order: [{ ids: [44, 33] }, { category: '1', ids: [11, 22] }],
            }),
          },
        },
      ])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
    })
  })
})
