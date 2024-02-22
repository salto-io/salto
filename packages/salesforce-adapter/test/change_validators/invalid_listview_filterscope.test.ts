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
  Change,
  CORE_ANNOTATIONS,
  getAllChangeData,
  InstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/invalid_listview_filterscope'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

const createListView = (filterScopeValue: string): InstanceElement =>
  createInstanceElement(
    { fullName: 'Some.FullName', filterScope: filterScopeValue },
    mockTypes.ListView,
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: 'Opportunity' },
  )

describe('ListView filterScope validator', () => {
  describe('when filterScope changes to invalid value', () => {
    let filterScopeModificationChange: Change
    beforeEach(() => {
      const beforeRecord = createListView('Everything')
      const afterRecord = beforeRecord.clone()
      afterRecord.value.filterScope = 'MyTeamTerritory'
      filterScopeModificationChange = toChange({
        before: beforeRecord,
        after: afterRecord,
      })
    })

    it('should fail validation', async () => {
      const changeErrors = await changeValidator([
        filterScopeModificationChange,
      ])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const [beforeData] = getAllChangeData(filterScopeModificationChange)
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('when invalid filterScope value is added', () => {
    let filterScopeAdditionChange: Change
    beforeEach(() => {
      const record = createListView('MyTerritory')
      filterScopeAdditionChange = toChange({ after: record })
    })

    it('should fail validation', async () => {
      const changeErrors = await changeValidator([filterScopeAdditionChange])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const [beforeData] = getAllChangeData(filterScopeAdditionChange)
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('when filterScope is changed to a valid value', () => {
    let filterScopeAdditionChange: Change
    beforeEach(() => {
      const record = createListView('Everything')
      filterScopeAdditionChange = toChange({ after: record })
    })

    it('should pass validation', async () => {
      const changeErrors = await changeValidator([filterScopeAdditionChange])
      expect(changeErrors).toBeEmpty()
    })
  })

  describe('when filterScope does not change', () => {
    let irrelevantChange: Change
    beforeEach(() => {
      const beforeRecord = createListView('Everything')
      const afterRecord = createListView('Everything')
      irrelevantChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation', async () => {
      const changeErrors = await changeValidator([irrelevantChange])
      expect(changeErrors).toBeEmpty()
    })
  })

  describe('when the parent is not an Opportunity', () => {
    let filterScopeAdditionChange: Change
    beforeEach(() => {
      const record = createListView('MyTeamTerritory')
      record.annotations = { [CORE_ANNOTATIONS.PARENT]: 'Flow' }
      filterScopeAdditionChange = toChange({ after: record })
    })

    it('should pass validation', async () => {
      const changeErrors = await changeValidator([filterScopeAdditionChange])
      expect(changeErrors).toBeEmpty()
    })
  })
})
