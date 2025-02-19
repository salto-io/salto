/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  let item: definitions.GeneratedItem<definitions.ContextParams & definitions.deploy.ChangeAndExtendedContext, unknown>
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
          errors: {},
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
          errors: {},
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
    it('should add start time to all layers', async () => {
      expect((await addStartToLayers(item)).value).toEqual({
        schedule: {
          schedule_layers: [
            { rotation_virtual_start: '2021-01-01T00:00:00Z', start: '2021-01-01T00:00:00Z' },
            { rotation_virtual_start: '2021-01-01T00:00:00Z', start: '2021-01-01T00:00:00Z' },
          ],
        },
      })
    })
    it('should throw an error if value is not an object', async () => {
      item.value = 'not an object'
      await expect(addStartToLayers(item)).rejects.toThrow('Can not adjust when the value is not an object')
    })
    it('should return the value an error if schedule_layers is not an array', async () => {
      item.value = { schedule: { schedule_layers: 'not an array' } }
      expect(await addStartToLayers(item)).toEqual({ value: item.value })
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
        errors: {},
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
        errors: {},
      })
      expect(result).toBeFalsy()
    })
  })
})
