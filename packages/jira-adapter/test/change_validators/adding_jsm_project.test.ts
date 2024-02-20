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
import { PROJECT_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'
import { addJsmProjectValidator } from '../../src/change_validators/adding_jsm_project'

describe('addJsmProjectValidator', () => {
  let elementsSource: ReadOnlyElementsSource
  let projectInstace: InstanceElement
  let accountInfoInstance: InstanceElement
  beforeEach(() => {
    projectInstace = new InstanceElement('projectInstace', createEmptyType(PROJECT_TYPE), {
      projectTypeKey: 'service_desk',
      description: 'test',
    })
    accountInfoInstance = new InstanceElement('_config', createEmptyType('AccountInfo'), {
      license: {
        applications: [
          {
            id: 'jira-software',
            plan: 'PAID',
          },
        ],
      },
    })
  })
  it('should return error is if JSM is disabled in the service and trying to add JSM project', async () => {
    const changes = [toChange({ after: projectInstace })]
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([
      {
        elemID: projectInstace.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'JSM Project cannot be deployed to instance without JSM',
        detailedMessage:
          'This JSM project can not be deployed, as JSM is not enabled in the target instance. Enable JSM on your target first, then try again.',
      },
    ])
  })
  it('should return error if account info is not found', async () => {
    const changes = [toChange({ after: projectInstace })]
    elementsSource = buildElementsSourceFromElements([])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([
      {
        elemID: projectInstace.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'JSM Project cannot be deployed to instance without JSM',
        detailedMessage:
          'This JSM project can not be deployed, as JSM is not enabled in the target instance. Enable JSM on your target first, then try again.',
      },
    ])
  })
  it('should return error if account info does not have license', async () => {
    const changes = [toChange({ after: projectInstace })]
    accountInfoInstance = new InstanceElement('_config', createEmptyType('AccountInfo'), {})
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([
      {
        elemID: projectInstace.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'JSM Project cannot be deployed to instance without JSM',
        detailedMessage:
          'This JSM project can not be deployed, as JSM is not enabled in the target instance. Enable JSM on your target first, then try again.',
      },
    ])
  })
  it('should return error if account info does not have applications', async () => {
    const changes = [toChange({ after: projectInstace })]
    accountInfoInstance = new InstanceElement('_config', createEmptyType('AccountInfo'), {
      license: {},
    })
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([
      {
        elemID: projectInstace.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'JSM Project cannot be deployed to instance without JSM',
        detailedMessage:
          'This JSM project can not be deployed, as JSM is not enabled in the target instance. Enable JSM on your target first, then try again.',
      },
    ])
  })
  it('should not return error if it is not JSM project', async () => {
    const changes = [toChange({ after: projectInstace })]
    projectInstace.value.projectTypeKey = 'business'
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([])
  })
  it('should not return error if JSM is enabled in the service as Free edition', async () => {
    const changes = [toChange({ after: projectInstace })]
    accountInfoInstance = new InstanceElement('_config', createEmptyType('AccountInfo'), {
      license: {
        applications: [
          {
            id: 'jira-software',
            plan: 'FREE',
          },
          {
            id: 'jira-servicedesk',
            plan: 'FREE',
          },
        ],
      },
    })
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([])
  })
  it('should not return error if JSM is enabled in the service as Paid edition', async () => {
    const changes = [toChange({ after: projectInstace })]
    accountInfoInstance = new InstanceElement('_config', createEmptyType('AccountInfo'), {
      license: {
        applications: [
          {
            id: 'jira-software',
            plan: 'PAID',
          },
          {
            id: 'jira-servicedesk',
            plan: 'PAID',
          },
        ],
      },
    })
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([])
  })
  it('should not return error for modification changes', async () => {
    const projAfter = projectInstace.clone()
    projAfter.value.description = 'new description'
    const changes = [toChange({ before: projectInstace, after: projAfter })]
    elementsSource = buildElementsSourceFromElements([accountInfoInstance])
    expect(await addJsmProjectValidator(changes, elementsSource)).toEqual([])
  })
  it('should not return error if elementsSource is undefined', async () => {
    const changes = [toChange({ after: projectInstace })]
    expect(await addJsmProjectValidator(changes, undefined)).toEqual([])
  })
})
