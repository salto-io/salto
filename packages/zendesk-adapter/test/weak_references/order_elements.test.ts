/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { orderElementsHandler } from '../../src/weak_references/order_elements'
import { AUTOMATION_ORDER_TYPE_NAME, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME, TRIGGER_ORDER_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('order_elements', () => {
  let inst1: InstanceElement
  let inst2: InstanceElement
  let inst3: InstanceElement
  let instance: InstanceElement
  let customObjectFieldOrderInstance: InstanceElement
  let triggerOrderInstance: InstanceElement

  beforeEach(() => {
    const objType = new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_ORDER_TYPE_NAME) })
    inst1 = new InstanceElement('inst1', objType, { id: 11, position: 1, title: 'inst2', active: true })
    inst2 = new InstanceElement('inst2', objType, { id: 22, position: 2, title: 'inst1', active: true })
    inst3 = new InstanceElement('inst3', objType, { id: 22, position: 2, title: 'aaa', active: false })

    instance = new InstanceElement(
      'inst',
      objType,
      {
        active: [
          new ReferenceExpression(inst1.elemID, inst1),
          new ReferenceExpression(inst2.elemID, inst2),
        ],
        inactive: [
          new ReferenceExpression(inst3.elemID, inst3),
          { wowThisIsSuperValid: 'first!!1!' },
        ],
      }
    )

    customObjectFieldOrderInstance = new InstanceElement(
      'inst',
      new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME) }),
      {
        custom_object_fields: [
          new ReferenceExpression(inst1.elemID, inst1),
          new ReferenceExpression(inst2.elemID, inst2),
        ],
      }
    )

    triggerOrderInstance = new InstanceElement(
      'inst',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_ORDER_TYPE_NAME) }),
      {
        order: [
          {
            active: [
              new ReferenceExpression(inst1.elemID, inst1),
            ],
            inactive: [
              new ReferenceExpression(inst2.elemID, inst2),
            ],
          },
          {
            active: [
              new ReferenceExpression(inst3.elemID, inst3),
              new ReferenceExpression(inst3.elemID, inst3),
            ],
          },
        ],
      }
    )
  })
  describe('findWeakReferences', () => {
    it('should return weak references', async () => {
      const references = await orderElementsHandler.findWeakReferences([instance])

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('0', 'listItemId'), target: inst1.elemID, type: 'weak' },
        { source: instance.elemID.createNestedID('1', 'listItemId'), target: inst2.elemID, type: 'weak' },
        { source: instance.elemID.createNestedID('2', 'listItemId'), target: inst3.elemID, type: 'weak' },
      ])
    })
    describe('special order cases: custom_object_field_order', () => {
      it('should return weak references', async () => {
        const references = await orderElementsHandler.findWeakReferences([customObjectFieldOrderInstance])

        expect(references).toEqual([
          { source: customObjectFieldOrderInstance.elemID.createNestedID('0', 'listItemId'), target: inst1.elemID, type: 'weak' },
          { source: customObjectFieldOrderInstance.elemID.createNestedID('1', 'listItemId'), target: inst2.elemID, type: 'weak' },
        ])
      })
    })
    describe('special order cases: trigger_order', () => {
      it('should return weak references', async () => {
        const references = await orderElementsHandler.findWeakReferences([triggerOrderInstance])

        expect(references).toEqual([
          { source: triggerOrderInstance.elemID.createNestedID('0', 'listItemId'), target: inst1.elemID, type: 'weak' },
          { source: triggerOrderInstance.elemID.createNestedID('1', 'listItemId'), target: inst2.elemID, type: 'weak' },
          { source: triggerOrderInstance.elemID.createNestedID('2', 'listItemId'), target: inst3.elemID, type: 'weak' },
          { source: triggerOrderInstance.elemID.createNestedID('3', 'listItemId'), target: inst3.elemID, type: 'weak' },
        ])
      })
    })

    it('should do nothing if received invalid order list', async () => {
      instance.value.active = 'invalid'
      instance.value.inactive = 'invalid'
      const references = await orderElementsHandler.findWeakReferences([instance])

      expect(references).toEqual([])
    })

    it('should do nothing if there are no list references', async () => {
      delete instance.value.active
      delete instance.value.inactive
      const references = await orderElementsHandler.findWeakReferences([instance])

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    let elementsSource: ReadOnlyElementsSource
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([instance, inst1, inst3])
    })

    it('should remove the invalid projects', async () => {
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('active'),
          severity: 'Info',
          message: 'Deploying automation_order.active without all attached automations',
          detailedMessage: 'This automation_order.active is attached to some automations that do not exist in the target environment. It will be deployed without referencing these automations.',
        },
        {
          elemID: instance.elemID.createNestedID('inactive'),
          severity: 'Info',
          message: 'Deploying automation_order.inactive without all attached automations',
          detailedMessage: 'This automation_order.inactive is attached to some automations that do not exist in the target environment. It will be deployed without referencing these automations.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0] as InstanceElement
      expect(fixedElement.value.active).toEqual([
        new ReferenceExpression(inst1.elemID, inst1),
      ])
      expect(fixedElement.value.inactive).toEqual([
        new ReferenceExpression(inst3.elemID, inst3),
      ])
    })

    describe('special order cases: custom_object_field_order', () => {
      it('should remove the invalid projects', async () => {
        const fixes = await orderElementsHandler
          .removeWeakReferences({ elementsSource })([customObjectFieldOrderInstance])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0] as InstanceElement
        expect(fixedElement.value.custom_object_fields).toEqual([
          new ReferenceExpression(inst1.elemID, inst1),
        ])
      })
    })

    describe('special order cases: trigger_order', () => {
      it('should remove the invalid projects', async () => {
        const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([triggerOrderInstance])

        expect(fixes.errors).toEqual([
          {
            elemID: triggerOrderInstance.elemID.createNestedID('order.0.inactive'),
            severity: 'Info',
            message: 'Deploying trigger_order.order.0.inactive without all attached triggers',
            detailedMessage: 'This trigger_order.order.0.inactive is attached to some triggers that do not exist in the target environment. It will be deployed without referencing these triggers.',
          },
        ])

        expect(fixes.fixedElements).toHaveLength(1)
        const fixedElement = fixes.fixedElements[0] as InstanceElement
        expect(fixedElement.value.order).toEqual([{
          active: [
            new ReferenceExpression(inst1.elemID, inst1),
          ],
          inactive: [],
        },
        {
          active: [
            new ReferenceExpression(inst3.elemID, inst3),
            new ReferenceExpression(inst3.elemID, inst3),
          ],
        }])
      })
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.active = 'invalid'
      instance.value.inactive = 'invalid'
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.active
      delete instance.value.inactive
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all projects are valid', async () => {
      instance.value.active = [
        new ReferenceExpression(inst1.elemID, inst1),
      ]
      instance.value.inactive = [
        new ReferenceExpression(inst3.elemID, inst3),
      ]
      const fixes = await orderElementsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
