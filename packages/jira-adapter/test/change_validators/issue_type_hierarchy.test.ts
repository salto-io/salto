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

import { InstanceElement, ReadOnlyElementsSource, toChange, SeverityLevel } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_NAME } from '../../src/constants'
import { createEmptyType, getAccountInfoInstance } from '../utils'
import { issueTypeHierarchyValidator } from '../../src/change_validators/issue_type_hierarchy'

describe('issue type hierarchy validator', () => {
  const issueTypeType = createEmptyType(ISSUE_TYPE_NAME)
  let issueTypeLevelTwo: InstanceElement
  let issueTypeLevelZero: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  beforeEach(() => {
    issueTypeLevelTwo = new InstanceElement('issueTypeLevelTwo', issueTypeType, {
      hierarchyLevel: 2,
      description: 'test',
      name: 'issueTypeLevelTwo',
    })
    issueTypeLevelZero = new InstanceElement('issueTypeLevelZero', issueTypeType, {
      hierarchyLevel: 0,
      description: 'test',
      name: 'issueTypeLevelZero',
    })
  })
  describe('free account', () => {
    const accountInfoInstanceFree = getAccountInfoInstance(true)
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
    })
    it('should return error if it is free account and adding issue type that has hierarchy level greater than 1', async () => {
      const changes = [toChange({ after: issueTypeLevelTwo })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeLevelTwo.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Cannot deploy issue type with hierarchy level greater than 0.',
          detailedMessage:
            'Issue type hierarchy level can only be -1, 0. To deploy, change the hierarchy level to one of the allowed values.',
        },
      ])
    })
    it('should return error if it is free account and modifying issue type to hierarchy level greater than 1', async () => {
      const issueTypeAfter = issueTypeLevelZero.clone()
      issueTypeAfter.value.hierarchyLevel = 2
      const changes = [toChange({ before: issueTypeLevelZero, after: issueTypeAfter })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeAfter.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Cannot deploy issue type with hierarchy level greater than 0.',
          detailedMessage:
            'Issue type hierarchy level can only be -1, 0. To deploy, change the hierarchy level to one of the allowed values.',
        },
      ])
    })
    it('should not return error if it is free account and adding issue type that has hierarchy level equal to 0 or -1', async () => {
      const changes = [toChange({ after: issueTypeLevelZero })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
    })
    it('should return error message for unsupported hierarchy change from 0 to -1 or backwards', async () => {
      const issueTypeAfter = issueTypeLevelZero.clone()
      issueTypeAfter.value.hierarchyLevel = -1
      const changes = [toChange({ before: issueTypeLevelZero, after: issueTypeAfter })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeAfter.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Cannot modify hierarchy level from 0 to -1 or vice versa.',
          detailedMessage: 'Issue type hierarchy level cannot be changed from 0 to -1 or vice versa.',
        },
      ])
    })
    it('should return error if there is no jira-software in the account info instance because it considered free acount', async () => {
      const accountInfoWithNoJiraSoftware = new InstanceElement('_config', createEmptyType('AccountInfo'), {
        license: {
          applications: [
            {
              id: 'jira-serviceDesk',
              plan: 'PAID',
            },
          ],
        },
      })
      elementsSource = buildElementsSourceFromElements([accountInfoWithNoJiraSoftware])
      const changes = [toChange({ after: issueTypeLevelTwo })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeLevelTwo.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Cannot deploy issue type with hierarchy level greater than 0.',
          detailedMessage:
            'Issue type hierarchy level can only be -1, 0. To deploy, change the hierarchy level to one of the allowed values.',
        },
      ])
    })
  })
  describe('paid account', () => {
    const accountInfoInstancePaid = getAccountInfoInstance(false)
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
    })
    it('should return warning if it is paid account and adding issue type that has hierarchy level greater than 1', async () => {
      const changes = [toChange({ after: issueTypeLevelTwo })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeLevelTwo.elemID,
          severity: 'Warning' as SeverityLevel,
          message: 'Unsupported hierarchy Level',
          detailedMessage:
            'issueTypeLevelTwo hierarchy level is unsupported for deployment. You will need to change it to your desired hierarchy level through the service. Please follow the instructions to make the necessary adjustments.',
          deployActions: {
            postAction: {
              title: 'Hierarchy level change is required',
              description: 'To change the hierarchy level to the desired hierarchy level, follow these steps:',
              showOnFailure: false,
              subActions: [
                'Go to Issue type hierarchy page in your jira account.',
                'Under "Jira Issue Types" column, Click on your desired hierarchy level.',
                'Select issueTypeLevelTwo from the list of issue types.',
                'Click on the "Save changes" button.',
              ],
            },
          },
        },
      ])
    })
    it('should return warning if it is paid account and changing issue type hierarchy', async () => {
      const issueTypeAfter = issueTypeLevelZero.clone()
      issueTypeAfter.value.hierarchyLevel = 2
      const changes = [toChange({ before: issueTypeLevelZero, after: issueTypeAfter })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
        {
          elemID: issueTypeAfter.elemID,
          severity: 'Warning' as SeverityLevel,
          message: 'Unsupported hierarchy Level',
          detailedMessage:
            'issueTypeLevelZero hierarchy level is unsupported for deployment. You will need to change it to your desired hierarchy level through the service. Please follow the instructions to make the necessary adjustments.',
          deployActions: {
            postAction: {
              title: 'Hierarchy level change is required',
              description: 'To change the hierarchy level to the desired hierarchy level, follow these steps:',
              showOnFailure: false,
              subActions: [
                'Go to Issue type hierarchy page in your jira account.',
                'Under "Jira Issue Types" column, Click on your desired hierarchy level.',
                'Select issueTypeLevelZero from the list of issue types.',
                'Click on the "Save changes" button.',
              ],
            },
          },
        },
      ])
    })
    it('should not return warning if it is paid account and adding issue type that has hierarchy level equal to 0 or -1', async () => {
      const changes = [toChange({ after: issueTypeLevelZero })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
    })
    it('should not return warning if is modification change of field different from hierarchy', async () => {
      const issueTypeAfter = issueTypeLevelTwo.clone()
      issueTypeAfter.value.description = 'new description'
      const changes = [toChange({ before: issueTypeLevelTwo, after: issueTypeAfter })]
      expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
    })
  })
})
