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

import { ObjectType, ElemID, InstanceElement, ReadOnlyElementsSource, toChange, SeverityLevel } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, ISSUE_TYPE_NAME } from '../../src/constants'
import { getAccountInfoInstance } from '../utils'
import { issueTypeHierarchyValidator } from '../../src/change_validators/issue_type_hierarchy'

describe('issue tyep hierarchy validator', () => {
  const issueTypeType = new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
  })
  const accountInfoInstanceFree = getAccountInfoInstance(true)
  const accountInfoInstancePaid = getAccountInfoInstance(false)
  let issueTypeInstance: InstanceElement
  let issueTypeInstanceTwo: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  beforeEach(() => {
    issueTypeInstance = new InstanceElement(
      'issueTypeInstance',
      issueTypeType,
      {
        hierarchyLevel: 2,
        description: 'test',
      }
    )
    issueTypeInstanceTwo = new InstanceElement(
      'issueTypeInstanceTwo',
      issueTypeType,
      {
        hierarchyLevel: 0,
        description: 'test',
      }
    )
  })

  it('should return error if it is free account and adding issue type that has hierarchy level greater than 1', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
    const changes = [toChange({ after: issueTypeInstance }), toChange({ after: issueTypeInstanceTwo })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
      {
        elemID: issueTypeInstance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot deploy issue type with hierarchy level greater than 0.',
        detailedMessage: 'Issue type hierarchy level can only be -1, 0. To deploy, change the hierarchy level to one of the allowed values.',
      },
    ])
  })
  it('should return error if it is free account and modifying issue type to hierarchy level greater than 1', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
    issueTypeInstance = issueTypeInstanceTwo.clone()
    issueTypeInstance.value.hierarchyLevel = 2
    const changes = [toChange({ before: issueTypeInstanceTwo, after: issueTypeInstance })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
      {
        elemID: issueTypeInstance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot deploy issue type with hierarchy level greater than 0.',
        detailedMessage: 'Issue type hierarchy level can only be -1, 0. To deploy, change the hierarchy level to one of the allowed values.',
      },
    ])
  })
  it('should not return error if it is free account and adding issue type that has hierarchy level equal to 0 or -1', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
    const changes = [toChange({ after: issueTypeInstanceTwo })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
  })
  it('should return warning if it is free account and changing issue type hierarchy from 0 to -1 or backwards', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
    issueTypeInstance = issueTypeInstanceTwo.clone()
    issueTypeInstance.value.hierarchyLevel = -1
    const changes = [toChange({ before: issueTypeInstanceTwo, after: issueTypeInstance })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
      {
        elemID: issueTypeInstance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Hierarchy Level Mismatch',
        detailedMessage: `${issueTypeInstance.value.name} hierarchy level mismatch. You will need to change it to your desired hierarchy level through the service. Please follow the instructions to make the necessary adjustments.`,
        deployActions: {
          postAction: {
            title: 'hierarchy level change is required',
            description: 'To change the hierarchy level to the desired hierarchy level, follow these steps:',
            showOnFailure: false,
            subActions: [
              'Go to Issue type hierarchy page in your jira account.',
              'Under "Jira Issue Types" column, Click on your desired hierarchy level.',
              `Select ${issueTypeInstance.value.name} from the list of issue types.`,
              'Click on the "Save changes" button.',
            ],
          },
        },
      }])
  })
  it('should return warning if it is paid account and adding issue type that has hierarchy level greater than 1', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
    const changes = [toChange({ after: issueTypeInstance }), toChange({ after: issueTypeInstanceTwo })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
      {
        elemID: issueTypeInstance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Hierarchy Level Mismatch',
        detailedMessage: `${issueTypeInstance.value.name} hierarchy level mismatch. You will need to change it to your desired hierarchy level through the service. Please follow the instructions to make the necessary adjustments.`,
        deployActions: {
          postAction: {
            title: 'hierarchy level change is required',
            description: 'To change the hierarchy level to the desired hierarchy level, follow these steps:',
            showOnFailure: false,
            subActions: [
              'Go to Issue type hierarchy page in your jira account.',
              'Under "Jira Issue Types" column, Click on your desired hierarchy level.',
              `Select ${issueTypeInstance.value.name} from the list of issue types.`,
              'Click on the "Save changes" button.',
            ],
          },
        },
      }])
  })
  it('should return warning if it is paid account and changing issue type hierarchy', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
    issueTypeInstance = issueTypeInstanceTwo.clone()
    issueTypeInstance.value.hierarchyLevel = 2
    const changes = [toChange({ before: issueTypeInstanceTwo, after: issueTypeInstance })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([
      {
        elemID: issueTypeInstance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Hierarchy Level Mismatch',
        detailedMessage: `${issueTypeInstance.value.name} hierarchy level mismatch. You will need to change it to your desired hierarchy level through the service. Please follow the instructions to make the necessary adjustments.`,
        deployActions: {
          postAction: {
            title: 'hierarchy level change is required',
            description: 'To change the hierarchy level to the desired hierarchy level, follow these steps:',
            showOnFailure: false,
            subActions: [
              'Go to Issue type hierarchy page in your jira account.',
              'Under "Jira Issue Types" column, Click on your desired hierarchy level.',
              `Select ${issueTypeInstance.value.name} from the list of issue types.`,
              'Click on the "Save changes" button.',
            ],
          },
        },
      }])
  })
  it('should not return warning if it is paid account and adding issue type that has hierarchy level equal to 0 or -1', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
    const changes = [toChange({ after: issueTypeInstanceTwo })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
  })
  it('should not return warning if is modification change of field different from hierarchy', async () => {
    elementsSource = buildElementsSourceFromElements([accountInfoInstancePaid])
    issueTypeInstanceTwo = issueTypeInstance.clone()
    issueTypeInstanceTwo.value.description = 'new description'
    const changes = [toChange({ before: issueTypeInstance, after: issueTypeInstanceTwo })]
    expect(await issueTypeHierarchyValidator(changes, elementsSource)).toEqual([])
  })
})
