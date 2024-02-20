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
  InstanceElement,
  ElemID,
  toChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  DependencyChange,
} from '@salto-io/adapter-api'
import { dashboardGadgetsDependencyChanger } from '../../src/dependency_changers/dashboard_gadgets'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, JIRA } from '../../src/constants'

describe('dashboardGadgetsDependencyChanger', () => {
  let dashboardType: ObjectType
  let dashboardGadgetType: ObjectType
  let dashboard: InstanceElement
  let dashboardGadget1: InstanceElement
  let dashboardGadget2: InstanceElement
  let dashboardGadget3: InstanceElement
  let dashboardGadget4: InstanceElement

  let dependencyChanges: DependencyChange[]
  beforeEach(async () => {
    dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_TYPE),
    })
    dashboardGadgetType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE),
    })
    dashboard = new InstanceElement('dashboard', dashboardType)

    dashboardGadget1 = new InstanceElement(
      'dashboardGadget1',
      dashboardGadgetType,
      {
        position: {
          column: 0,
          row: 0,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)],
      },
    )

    dashboardGadget2 = new InstanceElement(
      'dashboardGadget2',
      dashboardGadgetType,
      {
        position: {
          column: 0,
          row: 1,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)],
      },
    )

    dashboardGadget3 = new InstanceElement(
      'dashboardGadget3',
      dashboardGadgetType,
      {
        position: {
          column: 1,
          row: 2,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)],
      },
    )

    dashboardGadget4 = new InstanceElement(
      'dashboardGadget4',
      dashboardGadgetType,
      {
        position: {
          column: 0,
          row: 2,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'other'), {})],
      },
    )

    const inputChanges = new Map([
      [0, toChange({ after: dashboardGadget1 })],
      [1, toChange({ after: dashboardGadget2 })],
      [2, toChange({ after: dashboardGadget3 })],
      [3, toChange({ after: dashboardGadget4 })],
      [4, toChange({ after: dashboard })],
    ])

    dependencyChanges = [...(await dashboardGadgetsDependencyChanger(inputChanges, new Map()))]
  })

  it('should add dependency from gadget to its dashboard', async () => {
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(4)

    expect(dependencyChanges[2].action).toEqual('add')
    expect(dependencyChanges[2].dependency.source).toEqual(1)
    expect(dependencyChanges[2].dependency.target).toEqual(4)

    expect(dependencyChanges[4].action).toEqual('add')
    expect(dependencyChanges[4].dependency.source).toEqual(2)
    expect(dependencyChanges[4].dependency.target).toEqual(4)
  })

  it('should remove dependency from dashboard to gadget', async () => {
    expect(dependencyChanges[1].action).toEqual('remove')
    expect(dependencyChanges[1].dependency.source).toEqual(4)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[3].action).toEqual('remove')
    expect(dependencyChanges[3].dependency.source).toEqual(4)
    expect(dependencyChanges[3].dependency.target).toEqual(1)

    expect(dependencyChanges[5].action).toEqual('remove')
    expect(dependencyChanges[5].dependency.source).toEqual(4)
    expect(dependencyChanges[5].dependency.target).toEqual(2)
  })

  it('should add dependency from gadget to prev gadgets', async () => {
    expect(dependencyChanges[6].action).toEqual('add')
    expect(dependencyChanges[6].dependency.source).toEqual(1)
    expect(dependencyChanges[6].dependency.target).toEqual(0)
  })

  it('should not add more dependencies', async () => {
    expect(dependencyChanges).toHaveLength(7)
  })
})
