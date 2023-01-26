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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  CUSTOM_STATUS_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME, HOLD_CATEGORY, OPEN_CATEGORY,
  PENDING_CATEGORY, SOLVED_CATEGORY,
  ZENDESK,
} from '../../src/constants'
import { defaultCustomStatusesValidator } from '../../src/change_validators'

describe('defaultCustomStatusesValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, isActive: boolean, id: number): InstanceElement => new InstanceElement(
    `${category} ${isActive ? 'active' : ''}`,
    customStatusType,
    {
      id,
      status_category: category,
      active: isActive,
    }
  )
  const pendingActive = createStatus('pending', true, 1)
  const pending = createStatus('pending', false, 2)
  const solvedActive = createStatus('solved', true, 3)
  const openActive = createStatus('open', true, 5)
  const holdActive = createStatus('hold', true, 7)

  const defaultCustomStatusesType = new ObjectType(
    {
      elemID: new ElemID(ZENDESK, DEFAULT_CUSTOM_STATUSES_TYPE_NAME),
      fields: {
        [PENDING_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [SOLVED_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [OPEN_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [HOLD_CATEGORY]: { refType: BuiltinTypes.NUMBER },
      },
      isSettings: true,
    }
  )


  it('should not return an error when default is valid', async () => {
    const validDefaultCustomStatusesInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCustomStatusesType,
      {
        [PENDING_CATEGORY]: new ReferenceExpression(pendingActive.elemID, pendingActive),
        [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
        [OPEN_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
        [HOLD_CATEGORY]: new ReferenceExpression(holdActive.elemID, holdActive),
      },
    )
    const elementSource = buildElementsSourceFromElements([pendingActive, solvedActive, openActive, holdActive])
    const errors = await defaultCustomStatusesValidator([
      toChange({ before: validDefaultCustomStatusesInstance, after: validDefaultCustomStatusesInstance }),
    ], elementSource)
    expect(errors).toEqual([])
  })
  it('should not return an error when hold is inactive', async () => {
    const inactiveHold = holdActive.clone()
    inactiveHold.value.active = false
    const validDefaultCustomStatusesInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCustomStatusesType,
      {
        [PENDING_CATEGORY]: new ReferenceExpression(pendingActive.elemID, pendingActive),
        [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
        [OPEN_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
        [HOLD_CATEGORY]: new ReferenceExpression(inactiveHold.elemID, inactiveHold),
      },
    )
    const elementSource = buildElementsSourceFromElements([pendingActive, solvedActive, openActive, inactiveHold])
    const errors = await defaultCustomStatusesValidator([
      toChange({ before: validDefaultCustomStatusesInstance, after: validDefaultCustomStatusesInstance }),
    ], elementSource)
    expect(errors).toEqual([])
  })

  it('should return an error when default is not valid because of an inactive status', async () => {
    const invalidDefaultCustomStatusesInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCustomStatusesType,
      {
        [PENDING_CATEGORY]: new ReferenceExpression(pending.elemID, pending),
        [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
        [OPEN_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
        [HOLD_CATEGORY]: new ReferenceExpression(holdActive.elemID, holdActive),
      },
    )
    const elementSource = buildElementsSourceFromElements([pending, solvedActive, openActive, holdActive])
    const errors = await defaultCustomStatusesValidator([
      toChange({ before: invalidDefaultCustomStatusesInstance, after: invalidDefaultCustomStatusesInstance }),
    ], elementSource)
    expect(errors).toEqual([
      {
        elemID: invalidDefaultCustomStatusesInstance.elemID,
        severity: 'Error',
        message: 'Default custom statuses must be active.',
        detailedMessage: `Please set the default custom status ${pending.elemID.name} as active or choose a different default custom status`,
      },
    ])
  })
  it('should return an error when default is not valid because of mixed categories', async () => {
    const invalidDefaultCustomStatusesInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCustomStatusesType,
      {
        [PENDING_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
        [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
        [OPEN_CATEGORY]: new ReferenceExpression(pendingActive.elemID, pendingActive),
        [HOLD_CATEGORY]: new ReferenceExpression(holdActive.elemID, holdActive),
      },
    )
    const elementSource = buildElementsSourceFromElements([pendingActive, solvedActive, openActive, holdActive])
    const errors = await defaultCustomStatusesValidator([
      toChange({ before: invalidDefaultCustomStatusesInstance, after: invalidDefaultCustomStatusesInstance }),
    ], elementSource)
    expect(errors).toEqual([
      {
        elemID: invalidDefaultCustomStatusesInstance.elemID,
        severity: 'Error',
        message: 'Default custom status category mismatch',
        detailedMessage: `The category of the default custom status ${openActive.elemID.name} must be pending.`,
      },
      {
        elemID: invalidDefaultCustomStatusesInstance.elemID,
        severity: 'Error',
        message: 'Default custom status category mismatch',
        detailedMessage: `The category of the default custom status ${pendingActive.elemID.name} must be open.`,
      },
    ])
  })
  it('should return an error when default is not valid because of mixed categories and there is an inactive status',
    async () => {
      const invalidDefaultCustomStatusesInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        defaultCustomStatusesType,
        {
          [PENDING_CATEGORY]: new ReferenceExpression(openActive.elemID, openActive),
          [SOLVED_CATEGORY]: new ReferenceExpression(solvedActive.elemID, solvedActive),
          [OPEN_CATEGORY]: new ReferenceExpression(pending.elemID, pending),
          [HOLD_CATEGORY]: new ReferenceExpression(holdActive.elemID, holdActive),
        },
      )
      const elementSource = buildElementsSourceFromElements([pending, solvedActive, openActive, holdActive])
      const errors = await defaultCustomStatusesValidator([
        toChange({ before: invalidDefaultCustomStatusesInstance, after: invalidDefaultCustomStatusesInstance }),
      ], elementSource)
      expect(errors).toEqual([
        {
          elemID: invalidDefaultCustomStatusesInstance.elemID,
          severity: 'Error',
          message: 'Default custom statuses must be active.',
          detailedMessage: `Please set the default custom status ${pending.elemID.name} as active or choose a different default custom status`,
        },
        {
          elemID: invalidDefaultCustomStatusesInstance.elemID,
          severity: 'Error',
          message: 'Default custom status category mismatch',
          detailedMessage: `The category of the default custom status ${openActive.elemID.name} must be pending.`,
        },
        {
          elemID: invalidDefaultCustomStatusesInstance.elemID,
          severity: 'Error',
          message: 'Default custom status category mismatch',
          detailedMessage: `The category of the default custom status ${pending.elemID.name} must be open.`,
        },
      ])
    })
})
