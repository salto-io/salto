/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ObjectType,
  ElemID,
  ReadOnlyElementsSource,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { dashboardGadgetsValidator } from '../../src/change_validators/dashboard_gadgets'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, JIRA } from '../../src/constants'

describe('dashboardGadgetsValidator', () => {
  let dashboardGadgetType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let instance: InstanceElement

  beforeEach(() => {
    dashboardGadgetType = new ObjectType({ elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE) })
    instance = new InstanceElement(
      'instance',
      dashboardGadgetType,
      {
        position: {
          row: 1,
          column: 0,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'parent'))],
      },
    )

    elements = [instance]
    elementsSource = buildElementsSourceFromElements(elements)
  })

  it('should return an error when the position is already taken', async () => {
    const instance2 = new InstanceElement(
      'instance2',
      dashboardGadgetType,
      {
        position: {
          row: 1,
          column: 0,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'parent'))],
      },
    )

    elements.push(instance2)
    elementsSource = buildElementsSourceFromElements(elements)

    expect(await dashboardGadgetsValidator([toChange({ after: instance2 })], elementsSource)).toEqual([
      {
        elemID: instance2.elemID,
        severity: 'Error',
        message: 'Gadget position overlaps with existing gadgets',
        detailedMessage:
          'This gadget’s position clashes with other gadgets’ position: jira.DashboardGadget.instance.instance. Change its position, or other gadgets’ position, and try again.',
      },
    ])
  })

  it('should return not an error when the position is not taken', async () => {
    elementsSource = buildElementsSourceFromElements([])
    expect(await dashboardGadgetsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })

  it('should throw an error when there is no position', async () => {
    delete instance.value.position
    elementsSource = buildElementsSourceFromElements([])
    await expect(dashboardGadgetsValidator([toChange({ after: instance })], elementsSource)).rejects.toThrow()
  })

  it('should return not an error when the position is taken on different dashboard', async () => {
    const instance2 = new InstanceElement(
      'instance2',
      dashboardGadgetType,
      {
        position: {
          row: 1,
          column: 0,
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'parent2'))],
      },
    )

    elements.push(instance2)
    elementsSource = buildElementsSourceFromElements(elements)

    expect(await dashboardGadgetsValidator([toChange({ after: instance2 })], elementsSource)).toEqual([])
  })
})
