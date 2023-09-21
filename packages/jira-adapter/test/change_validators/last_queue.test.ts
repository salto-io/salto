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

import { CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, ReferenceExpression, SeverityLevel, toChange } from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { PROJECT_TYPE, JIRA, QUEUE_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'
import { deleteLastQueueValidator } from '../../src/change_validators/last_queue'
import { getDefaultConfig } from '../../src/config/config'

describe('deleteCustomerPermissionsValidator', () => {
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  const queueType = createEmptyType(QUEUE_TYPE)
  let elementsSource: ReadOnlyElementsSource
  let queueInstance: InstanceElement

  beforeEach(async () => {
    projectInstance = new InstanceElement(
      'project1',
      projectType,
      {
        id: 11111,
        name: 'project1',
        projectTypeKey: 'service_desk',
      },
      [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1']
    )
    queueInstance = new InstanceElement(
      'queue1',
      queueType,
      {
        id: 11111,
        name: 'queue1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(projectInstance.elemID, projectInstance),
        ],
      },
    )
    elementsSource = buildElementsSourceFromElements([projectInstance])
  })
  it('should return error if trying delete the last queue of a project', async () => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: queueInstance, after: undefined })],
      elementsSource
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: queueInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete a queue if its related project has no remaining queues.',
      detailedMessage: 'Cannot delete queue queue1 as its related project project1 must have at least one remaining queue.',
    })
  })
  it('should not return error if trying delete a queue of a project with other queues', async () => {
    const otherQueueInstance = new InstanceElement(
      'queue2',
      queueType,
      {
        id: 11111,
        name: 'queue2',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(projectInstance.elemID, projectInstance),
        ],
      },
    )
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: queueInstance, after: undefined })],
      buildElementsSourceFromElements([otherQueueInstance, projectInstance])
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if enableJSM is false', async () => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = false
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: queueInstance, after: undefined })],
      elementsSource
    )
    expect(changeErrors).toHaveLength(0)
  })
})
