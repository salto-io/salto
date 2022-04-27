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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { triggerOrderInstanceContainsAllTheInstancesValidator } from '../../src/change_validators/trigger_order_include_all_instances'
import { createOrderTypeName } from '../../src/filters/reorder/creator'
import { TYPE_NAME as TRIGGER_TYPE_NAME, TRIGGER_CATEGORY_TYPE_NAME } from '../../src/filters/reorder/trigger'

describe('triggerOrderInstanceContainsAllTheInstancesValidator', () => {
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, TRIGGER_TYPE_NAME) })
  const triggerCategoryType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, TRIGGER_CATEGORY_TYPE_NAME),
  })
  const triggerOrderType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, createOrderTypeName(TRIGGER_TYPE_NAME)),
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
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [orderInstance]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error if an instance is appearing twice in the same list', async () => {
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
              new ReferenceExpression(trigger3.elemID, trigger3),
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
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidOrderInstance.elemID,
      severity: 'Error',
      message: `Some instances were found multiple times in order instance ${invalidOrderInstance.elemID.typeName} under the ${category1.elemID.name} category in the inactive list`,
      detailedMessage: `Order was specified multiple times under the ${category1.elemID.name} category in the inactive list for the following instances of type ${TRIGGER_TYPE_NAME}: trigger3. Please make sure to include it in ${invalidOrderInstance.elemID.typeName} under the correct list once`,
    }])
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
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidOrderInstance.elemID,
      severity: 'Error',
      message: `Some instances were not found in order instance ${orderInstance.elemID.typeName} under the correct category`,
      detailedMessage: `Order not specified for the following instances of type ${TRIGGER_TYPE_NAME}: trigger3. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
    }])
  })
  it('should return an error if the instance exist on the other activity list', async () => {
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
              new ReferenceExpression(trigger3.elemID, trigger2),
            ],
            inactive: [
              new ReferenceExpression(trigger1.elemID, trigger2),
              new ReferenceExpression(trigger3.elemID, trigger2),
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
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidOrderInstance.elemID,
      severity: 'Error',
      message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName}`,
      detailedMessage: `The following instances of type ${TRIGGER_TYPE_NAME} were misplaced under the correct category: trigger1, trigger3. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
    }])
  })
  it('should return two errors if the instance exist only on the other activity list', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger2),
              new ReferenceExpression(trigger2.elemID, trigger2),
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
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([
      {
        elemID: invalidOrderInstance.elemID,
        severity: 'Error',
        message: `Some instances were not found in order instance ${orderInstance.elemID.typeName} under the correct category`,
        detailedMessage: `Order not specified for the following instances of type ${TRIGGER_TYPE_NAME}: trigger2. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
      },
      {
        elemID: invalidOrderInstance.elemID,
        severity: 'Error',
        message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName}`,
        detailedMessage: `The following instances of type ${TRIGGER_TYPE_NAME} were misplaced under the correct category: trigger2. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
      },
    ])
  })
  it('should return an error if the instance exist on the other category', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      triggerOrderType,
      {
        order: [
          {
            category: new ReferenceExpression(category1.elemID, category1),
            active: [
              new ReferenceExpression(trigger1.elemID, trigger1),
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger2),
            ],
          },
          {
            category: new ReferenceExpression(category2.elemID, category2),
            active: [],
            inactive: [
              new ReferenceExpression(trigger2.elemID, trigger2),
            ],
          },
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      triggerType, triggerOrderType, triggerCategoryType, category1, category2,
      trigger1, trigger2, trigger3, orderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([
      {
        elemID: invalidOrderInstance.elemID,
        severity: 'Error',
        message: `Some instances were not found in order instance ${orderInstance.elemID.typeName} under the correct category`,
        detailedMessage: `Order not specified for the following instances of type ${TRIGGER_TYPE_NAME}: trigger2. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
      },
      {
        elemID: invalidOrderInstance.elemID,
        severity: 'Error',
        message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName} under the wrong category`,
        detailedMessage: `The following instances of type ${TRIGGER_TYPE_NAME} were misplaced under the wrong category: trigger2. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
      },
    ])
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
            ],
            inactive: [
              new ReferenceExpression(trigger3.elemID, trigger2),
              new ReferenceExpression(trigger2.elemID, trigger2),
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
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await triggerOrderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
    )
    expect(errors).toHaveLength(0)
  })
})
