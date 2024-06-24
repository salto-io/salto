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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { ADAPTER_NAME, SCHEDULE_LAYERS_TYPE_NAME, SCHEDULE_TYPE_NAME } from '../../src/constants'
import { scheduleLayerRemovalValidator } from '../../src/change_validators'

describe('scheduleLayerRemovalValidator', () => {
  const scheduleInstance = new InstanceElement(
    'testSchema',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEDULE_TYPE_NAME) }),
    {
      timezone: 'uri',
      id: 'uri',
    },
  )
  const scheduleLayerInstance = new InstanceElement(
    'testSchema',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEDULE_LAYERS_TYPE_NAME) }),
    {
      schedule: 'uri',
      start: 'uri',
      end: 'uri',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(scheduleInstance.elemID, scheduleInstance)],
    },
  )
  it('should return a Error if trying to remove a layer without removing the parent schedule', async () => {
    const errors = await scheduleLayerRemovalValidator([toChange({ before: scheduleLayerInstance })])
    expect(errors[0].detailedMessage).toEqual(
      'PagerDuty does not remove schedule layers, you can go to the service and disable the schedule layer',
    )
    expect(errors).toHaveLength(1)
  })
  it('should not return a Error if trying to remove a layer while removing the parent schedule', async () => {
    const errors = await scheduleLayerRemovalValidator([
      toChange({ before: scheduleInstance }),
      toChange({ before: scheduleLayerInstance }),
    ])
    expect(errors).toEqual([])
  })
})
