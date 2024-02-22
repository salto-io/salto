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
  CORE_ANNOTATIONS,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  SeverityLevel,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'
import { deleteLastQueueValidator } from '../../src/change_validators/last_queue'
import { JiraConfig, getDefaultConfig } from '../../src/config/config'

describe('lastQueueValidator', () => {
  let projectInstance: InstanceElement
  const queueType = createEmptyType(QUEUE_TYPE)
  let elementsSource: ReadOnlyElementsSource
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
    elementsSource = buildElementsSourceFromElements([projectInstance])
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
  })
  it('should return error if trying delete the last queue of a project', async () => {
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator([toChange({ before: queueInstance })], elementsSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: queueInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete a project’s only queue',
      detailedMessage: 'Cannot delete this queue, as its the last remaining queue in project project1.',
    })
  })
  it('should not return error if trying delete a queue of a project with other queues', async () => {
    const otherQueueInstance = new InstanceElement(
      'queue2',
      queueType,
      {
        id: 33,
        name: 'queue2',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
      },
    )
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: queueInstance })],
      buildElementsSourceFromElements([otherQueueInstance, projectInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return error if tyring to delete all the queues of a project', async () => {
    const otherQueueInstance = new InstanceElement(
      'queue2',
      queueType,
      {
        id: 33,
        name: 'queue2',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
      },
    )
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: queueInstance }), toChange({ before: otherQueueInstance })],
      buildElementsSourceFromElements([projectInstance]),
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      elemID: queueInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete a project’s only queue',
      detailedMessage: 'Cannot delete this queue, as its the last remaining queue in project project1.',
    })
  })
  it('should not return error if enableJSM is false', async () => {
    config.fetch.enableJSM = false
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator([toChange({ before: queueInstance })], elementsSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if queue does not have valid parent', async () => {
    queueInstance.annotations[CORE_ANNOTATIONS.PARENT] = ['unvalidParent']
    config.fetch.enableJSM = false
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator([toChange({ before: queueInstance })], elementsSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if is addition change', async () => {
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator([toChange({ after: queueInstance })], elementsSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if trying to delete the lase queue with the project', async () => {
    const validator = deleteLastQueueValidator(config)
    const changeErrors = await validator(
      [toChange({ before: projectInstance }), toChange({ before: queueInstance })],
      buildElementsSourceFromElements([]),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
