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

import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, SeverityLevel, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'
import { defaultAdditionQueueValidator } from '../../src/change_validators/default_addition_queue'
import { JiraConfig, getDefaultConfig } from '../../src/config/config'

describe('defaultAdditionQueueValidator', () => {
  let projectInstance: InstanceElement
  const queueType = createEmptyType(QUEUE_TYPE)
  let queueInstance: InstanceElement
  let config: JiraConfig
  beforeEach(async () => {
    projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
      id: 11111,
      name: 'project1',
      projectTypeKey: 'service_desk',
    })
    queueInstance = new InstanceElement(
      'queue1',
      queueType,
      {
        id: 22,
        name: 'queue1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
      },
    )
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
  })
  it('should not return error if is addition change of a new named queue', async () => {
    const validator = defaultAdditionQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ after: queueInstance })],
      buildElementsSourceFromElements([projectInstance, queueInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if queue has a unvalid parent', async () => {
    queueInstance.annotations[CORE_ANNOTATIONS.PARENT] = ['unvalidParent']
    const validator = defaultAdditionQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ after: queueInstance })],
      buildElementsSourceFromElements([projectInstance, queueInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('shuould return error if trying to add a queue with the same name as another queue in the project', async () => {
    const otherQueueInstance = new InstanceElement(
      'queue2',
      queueType,
      {
        id: 33,
        name: 'queue1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
      },
    )
    const validator = defaultAdditionQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ after: otherQueueInstance })],
      buildElementsSourceFromElements([queueInstance, projectInstance, otherQueueInstance]),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: otherQueueInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy queue, because queues names must be unique',
      detailedMessage: 'Cannot deploy this queue, as it has the same name as another queue in project project1.',
    })
  })
})
