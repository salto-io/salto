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

import { definitions } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ChangeGroup,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { addStartToLayers, addTimeZone, shouldChangeLayer } from '../../../src/definitions/utils/schedule_layers'
import { ADAPTER_NAME, SCHEDULE_LAYERS_TYPE_NAME, SCHEDULE_TYPE_NAME } from '../../../src/constants'

describe('schedule layers definitions utils', () => {
  let item: definitions.GeneratedItem<definitions.ContextParams & definitions.deploy.ChangeAndContext, unknown>
  describe('addTimeZone', () => {
    beforeEach(() => {
      const change = toChange({
        after: new InstanceElement('aaa', new ObjectType({ elemID: new ElemID('salto', 'type') }), {
          something: 'else',
          rotation_virtual_start: '2021-01-01T00:00:00Z',
        }),
      })
      item = {
        typeName: 'mockType',
        context: {
          additionalContext: {
            time_zone: 'Tel Aviv',
          },
          change,
          changeGroup: {
            groupID: 'a',
            changes: [change],
          },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
        value: { something: 'else', rotation_virtual_start: '2021-01-01T00:00:00Z' },
      }
    })
    it('should add time zone from additionalContext', async () => {
      expect((await addTimeZone(item)).value).toEqual({
        schedule: {
          schedule_layers: [
            { something: 'else', rotation_virtual_start: '2021-01-01T00:00:00Z', start: '2021-01-01T00:00:00Z' },
          ],
          time_zone: 'Tel Aviv',
        },
      })
    })
  })

  describe('addStartToLayers', () => {
    beforeEach(() => {
      const change = toChange({
        after: new InstanceElement('aaa', new ObjectType({ elemID: new ElemID('salto', 'type') }), {
          schedule: {
            schedule_layers: [
              { rotation_virtual_start: '2021-01-01T00:00:00Z' },
              { rotation_virtual_start: '2021-01-01T00:00:00Z' },
            ],
          },
        }),
      })
      item = {
        typeName: 'mockType',
        context: {
          change,
          changeGroup: {
            groupID: 'a',
            changes: [change],
          },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
        value: {
          schedule: {
            schedule_layers: [
              { rotation_virtual_start: '2021-01-01T00:00:00Z' },
              { rotation_virtual_start: '2021-01-01T00:00:00Z' },
            ],
          },
        },
      }
    })
    it('should add start time to all layers', () => {
      expect(addStartToLayers(item).value).toEqual({
        schedule: {
          schedule_layers: [
            { rotation_virtual_start: '2021-01-01T00:00:00Z', start: '2021-01-01T00:00:00Z' },
            { rotation_virtual_start: '2021-01-01T00:00:00Z', start: '2021-01-01T00:00:00Z' },
          ],
        },
      })
    })
  })

  describe('shouldChangeLayer', () => {
    let changeGroup: ChangeGroup

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
    const layerChange = toChange({ before: scheduleLayerInstance })
    const scheduleChange = toChange({ before: scheduleInstance })

    it('should return true if parent schedule is not in the change group', () => {
      changeGroup = {
        groupID: 'a',
        changes: [layerChange],
      }
      const customFunc = shouldChangeLayer.custom
      if (customFunc === undefined) {
        throw new Error('isParentScheduleChanged.custom is undefined')
      }
      const result = customFunc({})({
        changeGroup,
        change: layerChange,
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      })
      expect(result).toBeTruthy()
    })
    it('should return false if parent schedule is in the change group', () => {
      changeGroup = {
        groupID: 'a',
        changes: [layerChange, scheduleChange],
      }
      const customFunc = shouldChangeLayer.custom
      if (customFunc === undefined) {
        throw new Error('isParentScheduleChanged.custom is undefined')
      }
      const result = customFunc({})({
        changeGroup,
        change: layerChange,
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      })
      expect(result).toBeFalsy()
    })
  })
})
