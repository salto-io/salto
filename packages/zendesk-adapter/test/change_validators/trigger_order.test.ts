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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK } from '../../src/constants'
import { createWrongPlaceErrorMessage, triggerOrderInstanceContainsAllTheInstancesValidator } from '../../src/change_validators/trigger_order'
import { TYPE_NAME as TRIGGER_TYPE_NAME, TRIGGER_CATEGORY_TYPE_NAME } from '../../src/filters/reorder/trigger'
import { createOrderTypeName } from '../../src/filters/reorder/creator'

describe('triggerOrderInstanceContainsAllTheInstancesValidator', () => {
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
  const triggerCategoryType = new ObjectType({
    elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME),
  })
  const triggerOrderType = new ObjectType({
    elemID: new ElemID(ZENDESK, createOrderTypeName(TRIGGER_TYPE_NAME)),
  })
  const category1 = new InstanceElement(
    'category1',
    triggerCategoryType,
    { name: 'category1' },
  )
  const category2 = new InstanceElement(
    'category2',
    triggerCategoryType,
    { name: 'category2' },
  )
  const trigger1 = new InstanceElement(
    'trigger1',
    triggerType,
    { title: 'trigger1', active: true, category_id: new ReferenceExpression(category1.elemID, category1) },
  )
  const trigger2 = new InstanceElement(
    'trigger2',
    triggerType,
    { title: 'trigger2', active: true, category_id: new ReferenceExpression(category1.elemID, category1) },
  )
  const trigger3 = new InstanceElement(
    'trigger3',
    triggerType,
    { title: 'trigger3', active: false, category_id: new ReferenceExpression(category1.elemID, category1) },
  )
  const orderInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    triggerOrderType,
    {
      order: [
        {
          category: new ReferenceExpression(category1.elemID, category1),
          active: [
            new ReferenceExpression(trigger1.elemID, trigger1),
            new ReferenceExpression(trigger2.elemID, trigger2),
          ],
          inactive: [
            new ReferenceExpression(trigger3.elemID, trigger3),
          ],
        },
        {
          category: new ReferenceExpression(category2.elemID, category2),
          active: [],
          inactive: [],
        },
      ],
    },
  )
  it('should not return an error if all the instances appear in the order elements', async () => {
    const triggerToAdd = trigger2.clone()
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToAdd = [triggerToAdd]
    const elementsToModify = [orderInstance]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e }))
        .concat(elementsToModify.map(e => toChange({ before: e, after: e }))),
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error if the instance does not exist in the correct activity list', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
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
            active: [],
            inactive: [],
          },
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, invalidOrderInstance,
    ].map(e => e.clone()))
    const elementsToAdd = [trigger3.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: trigger3.elemID,
      severity: 'Warning',
      message: 'Order not specified',
      detailedMessage: `Element ${trigger3.elemID.name} of type ${trigger3.elemID.typeName} is not listed in the ${trigger3.elemID.typeName} sort order under the ${category1.elemID.name} category.  Therefore, it will be added at the end by default.  
If the order is important, please include it under the ${category1.elemID.name} category in the inactive list`,
    }])
  })
  it('should return an error if the instance does exist in the wrong activity list in the same category', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
              new ReferenceExpression(trigger2.elemID, trigger2),
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
          {
            category: new ReferenceExpression(category2.elemID, category2),
            active: [],
            inactive: [],
          },
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, invalidOrderInstance,
    ].map(e => e.clone()))
    const elementsToAdd = [trigger3.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toEqual([createWrongPlaceErrorMessage(
      trigger3.elemID,
      createOrderTypeName(trigger3.elemID.typeName),
      false
    )])
  })
  it('should return an error if the instance does exist in the wrong activity list in the wrong category', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
              new ReferenceExpression(trigger2.elemID, trigger2),
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
          {
            category: new ReferenceExpression(category2.elemID, category2),
            active: [],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, invalidOrderInstance,
    ].map(e => e.clone()))
    const elementsToAdd = [trigger3.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toEqual([createWrongPlaceErrorMessage(
      trigger3.elemID,
      createOrderTypeName(trigger3.elemID.typeName),
      false,
    )])
  })
  it('should not return an error if there is no elements source', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
              new ReferenceExpression(trigger2.elemID, trigger2),
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
          {
            category: new ReferenceExpression(category2.elemID, category2),
            active: [],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
        ],
      },
    )
    const elementsToAdd = [trigger3.clone(), invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if there is no order instance', async () => {
    const elementsToAdd = [trigger3.clone()]
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3,
    ].map(e => e.clone()))
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error if instance has invalid category', async () => {
    const invalidTrigger = trigger3.clone()
    invalidTrigger.value.category_id = 4
    const elementsToAdd = [invalidTrigger]
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidTrigger.elemID,
      severity: 'Error',
      message: `Invalid category id '${invalidTrigger.value.category_id}'`,
      detailedMessage: `Invalid category id '${invalidTrigger.value.category_id}'`,
    }])
  })
  it('should not return an error if active field is missing and the change should not result error', async () => {
    const orderInstanceWithNoTriggers = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger3),
            ],
          },
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, orderInstanceWithNoTriggers, trigger3,
    ].map(e => e.clone()))
    const elementsToAdd = [trigger3.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toEqual([])
  })
})
