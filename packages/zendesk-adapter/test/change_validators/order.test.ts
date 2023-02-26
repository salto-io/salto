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
import { orderInstanceContainsAllTheInstancesValidator } from '../../src/change_validators/order'
import { createOrderTypeName } from '../../src/filters/reorder/creator'

describe('orderInstanceContainsAllTheInstancesValidator', () => {
  const automationType = new ObjectType({ elemID: new ElemID(ZENDESK, 'automation') })
  const automationOrderType = new ObjectType({ elemID: new ElemID(ZENDESK, createOrderTypeName('automation')) })
  const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') })
  const workspaceOrderType = new ObjectType({ elemID: new ElemID(ZENDESK, createOrderTypeName('workspace')) })
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
    const automationToAdd = automation3.clone()
    const workspaceToAdd = workspace1.clone()
    const elementsSource = buildElementsSourceFromElements([
      automationType, automationOrderType, workspaceType, workspaceOrderType,
      automation1, automation2, automation3, workspace1, workspace2, workspace3,
      automationOrder, workspaceOrder,
    ].map(e => e.clone()))
    const elementsToAdd = [automationToAdd, workspaceToAdd]
    const elementsToModify = [automationOrder, workspaceOrder]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e }))
        .concat(elementsToModify.map(e => toChange({ before: e, after: e }))),
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
    const elementsToAdd = [automation3.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    const orderTypeName = createOrderTypeName(automation3.elemID.typeName)
    expect(errors).toEqual([{
      elemID: automation3.elemID,
      severity: 'Warning',
      message: 'Order not specified',
      detailedMessage: `Element ${automation3.elemID.name} of type ${automation3.elemID.typeName} is not listed in ${automation3.elemID.typeName} sort order.  Therefore, it will be added at the end by default.  If the order is important, please include it in ${orderTypeName} under the inactive list`,
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
    const elementsToAdd = [workspace1.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    const orderTypeName = createOrderTypeName(workspace1.elemID.typeName)
    expect(errors).toEqual([{
      elemID: workspace1.elemID,
      severity: 'Warning',
      message: `Element misplaced in ${orderTypeName}`,
      detailedMessage: `Element ${workspace1.elemID.name} of type ${workspace1.elemID.typeName} is misplaced in ${orderTypeName}. 
Please make sure to place it under the active list`,
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
    const elementsToAdd = [workspace1.clone(), invalidOrderInstance.clone()]
    const errors = await orderInstanceContainsAllTheInstancesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
    )
    expect(errors).toHaveLength(0)
  })
})
