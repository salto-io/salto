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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { orderElementsHandler } from '../../src/custom_references/weak_references/order_elements'
import {
  AUTOMATION_ORDER_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  TRIGGER_ORDER_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'

describe('order_elements', () => {
  let inst1: InstanceElement
  let inst2: InstanceElement
  let inst3: InstanceElement
  let orderInstance: InstanceElement
  let customObjectFieldOrderInstance: InstanceElement
  let triggerOrderInstance: InstanceElement

  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    const objType = new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_ORDER_TYPE_NAME) })
    inst1 = new InstanceElement('inst1', objType, { id: 11, position: 1, title: 'inst2', active: true })
    inst2 = new InstanceElement('inst2', objType, { id: 22, position: 2, title: 'inst1', active: true })
    inst3 = new InstanceElement('inst3', objType, { id: 22, position: 2, title: 'aaa', active: false })

    orderInstance = new InstanceElement('inst', objType, {
      active: [new ReferenceExpression(inst1.elemID, inst1), new ReferenceExpression(inst2.elemID, inst2)],
      inactive: [
        new ReferenceExpression(inst3.elemID, inst3),
        { wowThisIsSuperValid: 'first!!1!' },
        13, // This simulates a case where there is a missing reference, but enableMissingReferences is disabled
      ],
    })

    customObjectFieldOrderInstance = new InstanceElement(
      'inst',
      new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME) }),
      {
        custom_object_fields: [
          new ReferenceExpression(inst1.elemID, inst1),
          new ReferenceExpression(inst2.elemID, inst2),
        ],
      },
    )

    triggerOrderInstance = new InstanceElement(
      'inst',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_ORDER_TYPE_NAME) }),
      {
        order: [
          {
            active: [new ReferenceExpression(inst1.elemID, inst1)],
            inactive: [new ReferenceExpression(inst2.elemID, inst2)],
          },
          {
            active: [new ReferenceExpression(inst3.elemID, inst3), new ReferenceExpression(inst3.elemID, inst3)],
          },
        ],
      },
    )
  })
  describe('findWeakReferences', () => {
    it('should return weak references', async () => {
      const references = await orderElementsHandler.findWeakReferences([orderInstance], adapterConfig)

      expect(references).toEqual([
        { source: orderInstance.elemID.createNestedID('active', '0'), target: inst1.elemID, type: 'weak' },
        { source: orderInstance.elemID.createNestedID('active', '1'), target: inst2.elemID, type: 'weak' },
        { source: orderInstance.elemID.createNestedID('inactive', '0'), target: inst3.elemID, type: 'weak' },
      ])
    })
    describe('special order cases: custom_object_field_order', () => {
      it('should return weak references', async () => {
        const references = await orderElementsHandler.findWeakReferences(
          [customObjectFieldOrderInstance],
          adapterConfig,
        )

        expect(references).toEqual([
          {
            source: customObjectFieldOrderInstance.elemID.createNestedID('custom_object_fields', '0'),
            target: inst1.elemID,
            type: 'weak',
          },
          {
            source: customObjectFieldOrderInstance.elemID.createNestedID('custom_object_fields', '1'),
            target: inst2.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('special order cases: trigger_order', () => {
      it('should return weak references', async () => {
        const references = await orderElementsHandler.findWeakReferences([triggerOrderInstance], adapterConfig)

        expect(references).toEqual([
          {
            source: triggerOrderInstance.elemID.createNestedID('order.0.active', '0'),
            target: inst1.elemID,
            type: 'weak',
          },
          {
            source: triggerOrderInstance.elemID.createNestedID('order.0.inactive', '0'),
            target: inst2.elemID,
            type: 'weak',
          },
          {
            source: triggerOrderInstance.elemID.createNestedID('order.1.active', '0'),
            target: inst3.elemID,
            type: 'weak',
          },
          {
            source: triggerOrderInstance.elemID.createNestedID('order.1.active', '1'),
            target: inst3.elemID,
            type: 'weak',
          },
        ])
      })
    })

    it('should do nothing if received invalid order list', async () => {
      orderInstance.value.active = 'invalid'
      orderInstance.value.inactive = 'invalid'
      const references = await orderElementsHandler.findWeakReferences([orderInstance], adapterConfig)

      expect(references).toEqual([])
    })

    it('should do nothing if there are no list references', async () => {
      delete orderInstance.value.active
      delete orderInstance.value.inactive
      const references = await orderElementsHandler.findWeakReferences([orderInstance], adapterConfig)

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    let elementsSource: ReadOnlyElementsSource
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([orderInstance, inst1, inst3])
    })

    it('should remove the invalid references', async () => {
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([orderInstance])

      expect(fixes.errors).toEqual([
        {
          elemID: orderInstance.elemID.createNestedID('active'),
          severity: 'Info',
          message: 'Deploying automation_order.active without all attached automations',
          detailedMessage:
            'This automation_order.active is attached to some automations that do not exist in the target environment. It will be deployed without referencing these automations.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0] as InstanceElement
      expect(fixedElement.value.active).toEqual([new ReferenceExpression(inst1.elemID, inst1)])
      expect(fixedElement.value.inactive).toEqual([
        new ReferenceExpression(inst3.elemID, inst3),
        { wowThisIsSuperValid: 'first!!1!' },
        13,
      ])
    })

    describe('special order cases: custom_object_field_order', () => {
      it('should remove the invalid references', async () => {
        const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([
          customObjectFieldOrderInstance,
        ])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0] as InstanceElement
        expect(fixedElement.value.custom_object_fields).toEqual([new ReferenceExpression(inst1.elemID, inst1)])
      })
    })

    describe('special order cases: trigger_order', () => {
      it('should remove the invalid references', async () => {
        const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([triggerOrderInstance])

        expect(fixes.errors).toEqual([
          {
            elemID: triggerOrderInstance.elemID.createNestedID('order.0.inactive'),
            severity: 'Info',
            message: 'Deploying trigger_order.order.0.inactive without all attached triggers',
            detailedMessage:
              'This trigger_order.order.0.inactive is attached to some triggers that do not exist in the target environment. It will be deployed without referencing these triggers.',
          },
        ])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0] as InstanceElement
        expect(fixedElement.value.order).toEqual([
          {
            active: [new ReferenceExpression(inst1.elemID, inst1)],
            inactive: [],
          },
          {
            active: [new ReferenceExpression(inst3.elemID, inst3), new ReferenceExpression(inst3.elemID, inst3)],
          },
        ])
      })
    })

    it('should do nothing if received invalid order list', async () => {
      orderInstance.value.active = 'invalid'
      orderInstance.value.inactive = 'invalid'
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([orderInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no order lists', async () => {
      delete orderInstance.value.active
      delete orderInstance.value.inactive
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([orderInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all references are valid', async () => {
      orderInstance.value.active = [new ReferenceExpression(inst1.elemID, inst1)]
      orderInstance.value.inactive = [new ReferenceExpression(inst3.elemID, inst3)]
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([orderInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
