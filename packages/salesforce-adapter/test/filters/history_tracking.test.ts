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
import filterCreator from '../../src/filters/history_tracking'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { FilterWith } from '../../src/filter'
import { Types } from '../../src/transformers/transformer'
import { HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED } from '../../src/constants'

describe('History tracking', () => {
  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch'|'preDeploy'>
  describe('When fetching an object with history tracking disabled', () => {
    it('Should not modify the object', async () => {
      const inputType = mockTypes.Account.clone()
      inputType.annotations.enableHistory = false
      const expectedOutput = inputType.clone()
      delete expectedOutput.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
      const elements = [inputType]
      await filter.onFetch(elements)
      expect(elements).toEqual([expectedOutput])
    })
  })
  describe('When fetching an object with history tracking enabled', () => {
    const typeWithHistoryTrackedFields = createCustomObjectType('TypeWithHistoryTracking', {
      annotations: {
        enableHistory: true,
      },
      fields: {
        fieldWithHistoryTracking: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            name: 'fieldWithHistoryTracking',
            trackHistory: true,
          },
        },
        fieldWithoutHistoryTracking: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            name: 'fieldWithoutHistoryTracking',
            trackHistory: false,
          },
        },
      },
    })
    it('Should update the object and field annotations correctly', async () => {
      const elements = [typeWithHistoryTrackedFields.clone()]
      await filter.onFetch(elements)
      const trackedFieldNames = elements[0].annotations[HISTORY_TRACKED_FIELDS]
      expect(trackedFieldNames).toBeDefined()
      expect(trackedFieldNames).toEqual(['fieldWithHistoryTracking'])
      expect(elements[0].fields.fieldWithHistoryTracking.annotations.trackHistory).not.toBeDefined()
      expect(elements[0].fields.fieldWithoutHistoryTracking.annotations.trackHistory).not.toBeDefined()
      expect(elements[0].annotations[OBJECT_HISTORY_TRACKING_ENABLED]).not.toBeDefined()
    })
  })
})
