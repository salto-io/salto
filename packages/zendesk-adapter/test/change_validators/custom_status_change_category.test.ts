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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import {
  CUSTOM_STATUS_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { customStatusCategoryChangeValidator } from '../../src/change_validators'

describe('customStatusCategoryChangeValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, id: number): InstanceElement => new InstanceElement(
    `${category}`,
    customStatusType,
    {
      id,
      status_category: category,
      active: true,
    }
  )
  const pending = createStatus('pending', 1)

  it('should not return a warning when the change is not in the category', async () => {
    const afterPending = pending.clone()
    afterPending.value.active = false
    const errors = await customStatusCategoryChangeValidator([
      toChange({ before: pending, after: afterPending }),
    ])
    expect(errors).toEqual([])
  })
  it('should return a warning when the change is in the category', async () => {
    const afterPending = pending.clone()
    afterPending.value.status_category = 'solved'
    const errors = await customStatusCategoryChangeValidator([
      toChange({ before: pending, after: afterPending }),
    ])
    expect(errors).toEqual([{
      elemID: afterPending.elemID,
      severity: 'Error',
      message: 'Cannot modify custom status category.',
      detailedMessage: 'Modifying the category of a custom status is not supported in zendesk.',
    }])
  })
})
