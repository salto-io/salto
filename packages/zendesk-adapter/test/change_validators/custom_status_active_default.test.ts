/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  CUSTOM_STATUS_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME,
  HOLD_CATEGORY,
  OPEN_CATEGORY,
  PENDING_CATEGORY,
  SOLVED_CATEGORY,
  ZENDESK,
} from '../../src/constants'
import { customStatusActiveDefaultValidator } from '../../src/change_validators'

describe('customStatusActiveDefaultValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, isActive: boolean, id: number): InstanceElement =>
    new InstanceElement(`${category}`, customStatusType, {
      id,
      active: isActive,
      status_category: category,
    })
  const pendingActive = createStatus('pending', true, 1)
  const solvedActive = createStatus('solved', true, 2)
  const openActive = createStatus('open', true, 3)
  const holdActive = createStatus('hold', true, 4)

  const defaultCustomStatusesType = new ObjectType({
    elemID: new ElemID(ZENDESK, DEFAULT_CUSTOM_STATUSES_TYPE_NAME),
    fields: {
      [PENDING_CATEGORY]: { refType: BuiltinTypes.NUMBER },
      [SOLVED_CATEGORY]: { refType: BuiltinTypes.NUMBER },
      [OPEN_CATEGORY]: { refType: BuiltinTypes.NUMBER },
      [HOLD_CATEGORY]: { refType: BuiltinTypes.NUMBER },
    },
    isSettings: true,
  })
  const defaultCustomStatusesInstance = new InstanceElement(ElemID.CONFIG_NAME, defaultCustomStatusesType, {
    [PENDING_CATEGORY]: new ReferenceExpression(pendingActive.elemID, pendingActive),
    [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
    [OPEN_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
    [HOLD_CATEGORY]: new ReferenceExpression(holdActive.elemID, holdActive),
  })

  it('should not return an error when default status is active', async () => {
    const elementSource = buildElementsSourceFromElements([
      pendingActive,
      solvedActive,
      openActive,
      holdActive,
      defaultCustomStatusesInstance,
    ])
    const errors = await customStatusActiveDefaultValidator(
      [toChange({ before: pendingActive, after: pendingActive })],
      elementSource,
    )
    expect(errors).toEqual([])
  })
  it('should not return an error when default status for hold is inactive', async () => {
    const inactiveHold = holdActive.clone()
    inactiveHold.value.active = false
    const elementSource = buildElementsSourceFromElements([
      pendingActive,
      solvedActive,
      openActive,
      inactiveHold,
      defaultCustomStatusesInstance,
    ])
    const errors = await customStatusActiveDefaultValidator(
      [toChange({ before: holdActive, after: inactiveHold })],
      elementSource,
    )
    expect(errors).toEqual([])
  })

  it('should return an error when default status is inactive', async () => {
    const afterPending = pendingActive.clone()
    afterPending.value.active = false
    const elementSource = buildElementsSourceFromElements([
      afterPending,
      solvedActive,
      openActive,
      holdActive,
      defaultCustomStatusesInstance,
    ])
    const errors = await customStatusActiveDefaultValidator(
      [toChange({ before: pendingActive, after: afterPending })],
      elementSource,
    )
    expect(errors).toEqual([
      {
        elemID: afterPending.elemID,
        severity: 'Error',
        message: 'Default custom statuses must be active.',
        detailedMessage: `Please set the default custom status ${afterPending.elemID.name} as active or choose a different default custom status`,
      },
    ])
  })
})
