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
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import addImportantValuesFilter from '../../src/filters/add_important_values'
import { createEmptyType, getFilterParams } from '../utils'
import { AUTOMATION_TYPE, FIELD_TYPE, PROJECT_TYPE, SCHEDULED_JOB_TYPE } from '../../src/constants'

describe('add important values filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  // const automationType = createEmptyType(AUTOMATION_TYPE)
  const automationType = new ObjectType({
    elemID: new ElemID('test', AUTOMATION_TYPE),
  })
  const fieldType = createEmptyType(FIELD_TYPE)
  const projectType = createEmptyType(PROJECT_TYPE)
  const scheduledJobType = createEmptyType(SCHEDULED_JOB_TYPE)
  const noType = createEmptyType('noType')

  beforeEach(async () => {
    filter = addImportantValuesFilter(getFilterParams()) as FilterType
  })
  describe('onFetch', () => {
    it('should add important values annotation correctly', async () => {
      await filter.onFetch([automationType, fieldType, projectType, scheduledJobType])
      expect(automationType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'state', highlighted: true, indexed: true },
        { value: 'description', highlighted: true, indexed: false },
        { value: 'authorAccountId', highlighted: true, indexed: false },
        { value: 'authorAccountId.displayName', highlighted: false, indexed: true },
        { value: 'projects', highlighted: true, indexed: false },
        { value: 'trigger', highlighted: true, indexed: false },
        { value: 'components', highlighted: true, indexed: false },
        { value: 'trigger.type', highlighted: false, indexed: true },
        { value: 'labels', highlighted: true, indexed: true },
      ])
      expect(fieldType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'description', highlighted: true, indexed: false },
        { value: 'isLocked', highlighted: false, indexed: true },
        { value: 'type', highlighted: true, indexed: true },
      ])
      expect(projectType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'description', highlighted: true, indexed: false },
        { value: 'key', highlighted: true, indexed: false },
        { value: 'projectTypeKey', highlighted: true, indexed: true },
        { value: 'leadAccountID', highlighted: true, indexed: false },
        { value: 'leadAccountID.displayName', highlighted: false, indexed: true },
      ])
      expect(scheduledJobType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'enabled', highlighted: true, indexed: true },
        { value: 'script', highlighted: true, indexed: false },
        { value: 'atlassianUser', highlighted: true, indexed: false },
        { value: 'atlassianUser.displayName', highlighted: false, indexed: true },
      ])
      expect(noType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toBeUndefined()
    })
  })
})
