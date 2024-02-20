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
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { automationProjectsValidator } from '../../../src/change_validators/automation/automation_projects'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'

describe('automationProjectsValidator', () => {
  let automationType: ObjectType
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    elementsSource = buildElementsSourceFromElements([])

    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement('instance', automationType, {
      name: 'someName',
      projects: [],
    })
  })

  it('should return an error when there are no projects', async () => {
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deploy automation without projects.',
        detailedMessage:
          'In order to deploy an automation it must be either global, assigned to at least one project type, or assigned to at least one project that exist in the current environment.',
      },
    ])
  })

  it('should not return an error when assigned to a project', async () => {
    instance.value.projects = ['someProject']
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })

  it('should not return an error when global', async () => {
    delete instance.value.projects
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })
})
