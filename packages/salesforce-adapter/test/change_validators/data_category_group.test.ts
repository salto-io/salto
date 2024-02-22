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
import { toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/data_category_group'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('DataCategoryGroup ChangeValidator', () => {
  const afterRecord = createInstanceElement(
    { fullName: 'obj__c.record' },
    mockTypes.DataCategoryGroup,
  )

  it('should have warning when trying to add a new data category group', async () => {
    const changeErrors = await changeValidator([
      toChange({ after: afterRecord }),
    ])
    expect(changeErrors).toEqual([
      expect.objectContaining({
        elemID: afterRecord.elemID,
        severity: 'Warning',
      }),
    ])
  })
})
