/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { dashboardLayoutValidator } from '../../src/change_validators/dashboard_layout'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, JIRA } from '../../src/constants'

describe('dashboardLayoutValidator', () => {
  let dashboardType: ObjectType
  let instance: InstanceElement
  const gadgetInstance = new InstanceElement(
    'gadget',
    new ObjectType({ elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE) }),
    {
      position: {
        row: 0,
        column: 2,
      },
    },
  )

  beforeEach(() => {
    dashboardType = new ObjectType({ elemID: new ElemID(JIRA, DASHBOARD_TYPE) })

    instance = new InstanceElement('instance', dashboardType, {
      gadgets: [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_GADGET_TYPE, 'instance', 'inst'), gadgetInstance)],
    })
  })

  it('should return an error when new layout does not match current positions', async () => {
    instance.value.layout = 'AAA'

    const afterInstance = instance.clone()
    afterInstance.value.layout = 'AA'

    expect(await dashboardLayoutValidator([toChange({ before: instance, after: afterInstance })])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Dashboard gadget positions are out of bounds',
        detailedMessage:
          'This dashboard has gadgets with a column position which exceeds the number of columns (2) in the AA layout: inst. Please change the layout or re-position the gadgets to deploy this dashboard.',
      },
    ])
  })

  it('should not return an error when new layout does match current positions', async () => {
    instance.value.layout = 'AA'

    const afterInstance = instance.clone()
    afterInstance.value.layout = 'AAA'

    expect(await dashboardLayoutValidator([toChange({ before: instance, after: afterInstance })])).toEqual([])
  })
  it('should not on unresolved reference', async () => {
    instance.value.layout = 'AA'

    const afterInstance = instance.clone()
    afterInstance.value.layout = 'AAA'
    afterInstance.value.gadgets = [new ReferenceExpression(new ElemID(JIRA, DASHBOARD_GADGET_TYPE, 'instance', 'inst'))]
    const errorPromise = dashboardLayoutValidator([toChange({ before: instance, after: afterInstance })])
    await expect(errorPromise).resolves.not.toThrow()
  })

  it('should not return an error when there are no gadgets', async () => {
    instance.value.layout = 'AA'

    delete instance.value.gadgets

    const afterInstance = instance.clone()
    afterInstance.value.layout = 'AAA'

    expect(await dashboardLayoutValidator([toChange({ before: instance, after: afterInstance })])).toEqual([])
  })
})
