/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  ObjectType, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import filterCreator, {
  LEAD_CONVERT_SETTINGS_TYPE_ID, LEAD_TYPE_ID, CONVERT_SETTINGS_ANNOTATION, INSTANCE_FULL_NAME,
  OBJECT_MAPPING_FIELD, MAPPING_FIELDS_FIELD, INPUT_FIELD, OUTPUT_FIELD, OUTPUT_OBJECT,
} from '../../src/filters/lead_convert_settings'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { findElements } from '../utils'

describe('lead convert settings filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'> & FilterWith<'onUpdate'>

  const mockLead = new ObjectType(
    { elemID: LEAD_TYPE_ID }
  )

  const elemID = LEAD_CONVERT_SETTINGS_TYPE_ID
  const mockConvertSettingsType = new ObjectType(
    {
      elemID,
      fields: {
        [constants.INSTANCE_FULL_NAME_FIELD]:
          new Field(elemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.STRING),
        fake: new Field(elemID, 'fake', BuiltinTypes.BOOLEAN),
      },
      annotations: {
        [constants.METADATA_TYPE]: 'LeadConvertSettings',
      },
    }
  )

  const mockConvertSettingsInstance = new InstanceElement(
    INSTANCE_FULL_NAME,
    mockConvertSettingsType,
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'full',
      [OBJECT_MAPPING_FIELD]: [
        {
          [OUTPUT_OBJECT]: 'z',
        },
        {
          [MAPPING_FIELDS_FIELD]: [
            {
              [INPUT_FIELD]: 'a',
              [OUTPUT_FIELD]: 'b',
            },
            {
              [INPUT_FIELD]: 'd',
              [OUTPUT_FIELD]: 'c',
            },
            {
              [INPUT_FIELD]: 'a',
              [OUTPUT_FIELD]: 'a',
            },
          ],
          [OUTPUT_OBJECT]: 'a',
        },
      ],
      fake: 'true',
    },
  )

  describe('on fetch', () => {
    let leadPostFilter: ObjectType
    let testElements: Element[]

    beforeEach(async () => {
      testElements = [_.cloneDeep(mockLead),
        _.cloneDeep(mockConvertSettingsType),
        _.cloneDeep(mockConvertSettingsInstance)]
      await filter.onFetch(testElements)
      leadPostFilter = findElements(testElements, LEAD_TYPE_ID.name).pop() as ObjectType
    })

    it('should add annotations to lead', async () => {
      expect(leadPostFilter.annotationTypes[CONVERT_SETTINGS_ANNOTATION].elemID)
        .toEqual(LEAD_CONVERT_SETTINGS_TYPE_ID)
      expect(leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]).toBeDefined()
    })

    it('should convert to lists', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(Array.isArray(value[OBJECT_MAPPING_FIELD])).toBeTruthy()
      expect(Array.isArray(value[OBJECT_MAPPING_FIELD][0][MAPPING_FIELDS_FIELD])).toBeTruthy()
    })

    it('should convert to right type', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(value.fake).toBeTruthy()
    })

    it('should remove fullName', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(value[constants.INSTANCE_FULL_NAME_FIELD]).toBeUndefined()
      const type = leadPostFilter.annotationTypes[CONVERT_SETTINGS_ANNOTATION] as ObjectType
      expect(type.fields[constants.INSTANCE_FULL_NAME_FIELD]).toBeUndefined()
    })

    it('should sort the mapping fields and the object mapping', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(value[OBJECT_MAPPING_FIELD][0][MAPPING_FIELDS_FIELD]).toEqual([
        {
          [INPUT_FIELD]: 'a',
          [OUTPUT_FIELD]: 'a',
        },
        {
          [INPUT_FIELD]: 'a',
          [OUTPUT_FIELD]: 'b',
        },
        {
          [INPUT_FIELD]: 'd',
          [OUTPUT_FIELD]: 'c',
        },
      ])
    })

    describe('on update', () => {
      const clientUpdate = jest.spyOn(client, 'update').mockImplementation(() => Promise.resolve([]))

      beforeEach(async () => {
        const before = _.cloneDeep(mockLead)
        before.annotations[constants.METADATA_TYPE] = 'Lead'
        before.annotationTypes[CONVERT_SETTINGS_ANNOTATION] = mockConvertSettingsType
        before.annotations[CONVERT_SETTINGS_ANNOTATION] = {}
        before.annotations[CONVERT_SETTINGS_ANNOTATION].change = true
        const after = _.cloneDeep(before)
        after.annotations[CONVERT_SETTINGS_ANNOTATION].change = false
        await filter.onUpdate(before, after, [{ action: 'modify', data: { before, after } }])
      })

      it('should call client update', async () => {
      // validate client calls
        expect(clientUpdate.mock.calls).toHaveLength(1)
      })
    })
  })
})
