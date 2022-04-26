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
import { orderInstanceContainsAllTheInstancesValidator } from '../../src/change_validators/order_include_all_instances'
import { createOrderTypeName } from '../../src/filters/reorder/creator'

describe('orderInstanceContainsAllTheInstancesValidator', () => {
  const automationType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'automation') })
  const automationOrderType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, createOrderTypeName('automation')) })
  const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'workspace') })
  const workspaceOrderType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, createOrderTypeName('workspace')) })
  const automation1 = new InstanceElement(
    'automation1',
    automationType,
    { title: 'automation1', active: true, position: 1 },
  )
  const automation2 = new InstanceElement(
    'automation2',
    automationType,
    { title: 'automation2', active: true, position: 2 },
  )
  const automation3 = new InstanceElement(
    'automation3',
    automationType,
    { title: 'automation3', active: false, position: 3 },
  )
  const automationOrder = new InstanceElement(
    ElemID.CONFIG_NAME,
    automationOrderType,
    {
      active: [
        new ReferenceExpression(automation1.elemID, automation1),
        new ReferenceExpression(automation2.elemID, automation2),
      ],
      inactive: [
        new ReferenceExpression(automation3.elemID, automation3),
      ],
    },
  )
  const workspace1 = new InstanceElement(
    'workspace1',
    workspaceType,
    { title: 'workspace1', activated: true, position: 1 },
  )
  const workspace2 = new InstanceElement(
    'workspace2',
    workspaceType,
    { title: 'workspace2', activated: true, position: 2 },
  )
  const workspace3 = new InstanceElement(
    'workspace3',
    workspaceType,
    { title: 'workspace3', activated: false, position: 3 },
  )
  const workspaceOrder = new InstanceElement(
    ElemID.CONFIG_NAME,
    workspaceOrderType,
    {
      active: [
        new ReferenceExpression(workspace1.elemID, workspace1),
        new ReferenceExpression(workspace2.elemID, workspace2),
      ],
      inactive: [
        new ReferenceExpression(workspace3.elemID, workspace3),
      ],
    },
  )
  it('should not return an error if all the instances appear in the order elements', async () => {
    const elementsSource = buildElementsSourceFromElements([
      automationType, automationOrderType, workspaceType, workspaceOrderType,
      automation1, automation2, automation3, workspace1, workspace2, workspace3,
      automationOrder, workspaceOrder,
    ].map(e => e.clone()))
    const elementsToModify = [automationOrder, workspaceOrder]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error if the instance does not exist in the correct activity list', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      automationOrderType,
      {
        active: [
          new ReferenceExpression(automation1.elemID, automation1),
          new ReferenceExpression(automation2.elemID, automation2),
        ],
        inactive: [],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      automationType, automationOrderType, automation1, automation2,
      automation3, invalidOrderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidOrderInstance.elemID,
      severity: 'Error',
      message: `Some instances were not found in order instance ${invalidOrderInstance.elemID.typeName}`,
      detailedMessage: `Order not specified for the following instances of type ${automationType.elemID.typeName}: automation3. Please make sure to include it in ${invalidOrderInstance.elemID.typeName} under the correct list`,
    }])
  })
  it('should return an error if the instance exist on the other activity list', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      workspaceOrderType,
      {
        active: [
          new ReferenceExpression(workspace1.elemID, workspace1),
          new ReferenceExpression(workspace2.elemID, workspace2),
        ],
        inactive: [
          new ReferenceExpression(workspace3.elemID, workspace3),
          new ReferenceExpression(workspace1.elemID, workspace1),
        ],
      },
    )
    const elementsSource = buildElementsSourceFromElements([
      workspaceType, workspaceOrderType, workspace1, workspace2,
      workspace3, invalidOrderInstance,
    ].map(e => e.clone()))
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
      elementsSource,
    )
    expect(errors).toEqual([{
      elemID: invalidOrderInstance.elemID,
      severity: 'Error',
      message: `Some instances were misplaced in order instance ${invalidOrderInstance.elemID.typeName}`,
      detailedMessage: `The following instances of type ${workspaceType.elemID.typeName} were misplaced: workspace1. Please make sure to include it in ${invalidOrderInstance.elemID.typeName} under the correct list`,
    }])
  })
  it('should not return an error if there is no elements source', async () => {
    const invalidOrderInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      workspaceOrderType,
      {
        active: [
          new ReferenceExpression(workspace1.elemID, workspace1),
          new ReferenceExpression(workspace2.elemID, workspace2),
        ],
        inactive: [
          new ReferenceExpression(workspace3.elemID, workspace3),
          new ReferenceExpression(workspace1.elemID, workspace1),
        ],
      },
    )
    const elementsToModify = [invalidOrderInstance.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToModify.map(e => toChange({ before: e, after: e })),
    )
    expect(errors).toHaveLength(0)
  })
})
