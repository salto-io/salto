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
import { customStatusCategoryValidator } from '../../src/change_validators'

describe('customStatusCategoryValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, id: number): InstanceElement => new InstanceElement(
    `${category}`,
    customStatusType,
    {
      id,
      status_category: category,
    }
  )
  const validStatus = createStatus('pending', 1)
  const invalidStatus = createStatus('invalid', 1)


  it('should not return an error for a modification change when the category is valid', async () => {
    const errors = await customStatusCategoryValidator([
      toChange({ before: validStatus, after: validStatus }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return an error for an addition change when the category is valid', async () => {
    const errors = await customStatusCategoryValidator([
      toChange({ after: validStatus }),
    ])
    expect(errors).toEqual([])
  })
  it('should return an error for an addition change when the category is not valid', async () => {
    const errors = await customStatusCategoryValidator([
      toChange({ after: invalidStatus }),
    ])
    expect(errors).toEqual([
      {
        elemID: invalidStatus.elemID,
        severity: 'Error',
        message: 'Invalid status category.',
        detailedMessage: `Invalid status category for ${invalidStatus.elemID.name}. Status category value must be one of: open, pending, hold, and solved`,
      },
    ])
  })
  it('should return an error for a modification change when the category is not valid', async () => {
    const errors = await customStatusCategoryValidator([
      toChange({ before: invalidStatus, after: invalidStatus }),
    ])
    expect(errors).toEqual([
      {
        elemID: invalidStatus.elemID,
        severity: 'Error',
        message: 'Invalid status category.',
        detailedMessage: `Invalid status category for ${invalidStatus.elemID.name}. Status category value must be one of: open, pending, hold, and solved`,
      },
    ])
  })
})
