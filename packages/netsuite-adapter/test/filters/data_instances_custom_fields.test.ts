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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_custom_fields'
import { CUSTOM_FIELD_LIST, NETSUITE } from '../../src/constants'
import { SOAP_FIELDS_TYPES } from '../../src/client/suiteapp_client/soap_client/types'
import { PLATFORM_CORE_CUSTOM_FIELD } from '../../src/client/suiteapp_client/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('data_instances_custom_fields', () => {
  describe('onFetch', () => {
    let instance: InstanceElement

    beforeEach(() => {
      instance = new InstanceElement(
        'name',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'Customer'),
          fields: { custom_someId: { refType: BuiltinTypes.NUMBER } },
          annotations: { source: 'soap' },
        }),
        {
          [CUSTOM_FIELD_LIST]: {
            customField: [
              {
                value: '123',
                scriptId: 'someId',
              },
            ],
          },
        },
      )
    })
    it('should add an integer field', async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.value[CUSTOM_FIELD_LIST]).toBeUndefined()
      expect(instance.value.custom_someId).toBe(123)
    })

    it('should do nothing if there are no custom fields values', async () => {
      delete instance.value[CUSTOM_FIELD_LIST]
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.value).toEqual({})
    })
  })

  describe('preDeploy', () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'Customer'),
      annotations: { source: 'soap' },
    })
    let instance: InstanceElement
    beforeEach(() => {
      instance = new InstanceElement('name', type, {
        custom_a: true,
        custom_b: 'string',
        custom_c: 1.5,
        custom_d: '2020-05-02T13:44:31.000-07:00',
        custom_e: {},
        custom_f: 1,
        custom_g: [{}],
        custom_h: '2020-05-02T13:44:31.000Z',
      })
    })
    it('should convert all custom fields to customFieldList on instance addition', async () => {
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        [CUSTOM_FIELD_LIST]: {
          [PLATFORM_CORE_CUSTOM_FIELD]: [
            {
              attributes: {
                scriptId: 'a',
                'xsi:type': SOAP_FIELDS_TYPES.BOOLEAN,
              },
              'platformCore:value': true,
            },
            {
              attributes: {
                scriptId: 'b',
                'xsi:type': SOAP_FIELDS_TYPES.STRING,
              },
              'platformCore:value': 'string',
            },
            {
              attributes: {
                scriptId: 'c',
                'xsi:type': SOAP_FIELDS_TYPES.DOUBLE,
              },
              'platformCore:value': 1.5,
            },
            {
              attributes: {
                scriptId: 'd',
                'xsi:type': SOAP_FIELDS_TYPES.DATE,
              },
              'platformCore:value': '2020-05-02T13:44:31.000-07:00',
            },
            {
              attributes: {
                scriptId: 'e',
                'xsi:type': SOAP_FIELDS_TYPES.SELECT,
              },
              'platformCore:value': {},
            },
            {
              attributes: {
                scriptId: 'f',
                'xsi:type': SOAP_FIELDS_TYPES.LONG,
              },
              'platformCore:value': 1,
            },
            {
              attributes: {
                scriptId: 'g',
                'xsi:type': SOAP_FIELDS_TYPES.MULTISELECT,
              },
              'platformCore:value': [{}],
            },
            {
              attributes: {
                scriptId: 'h',
                'xsi:type': SOAP_FIELDS_TYPES.DATE,
              },
              'platformCore:value': '2020-05-02T13:44:31.000Z',
            },
          ],
        },
      })
    })
    it('should convert only changed custom fields to customFieldList on instance modification', async () => {
      const before = instance.clone()
      instance.value.custom_a = false
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ before, after: instance })])
      expect(instance.value).toEqual({
        [CUSTOM_FIELD_LIST]: {
          [PLATFORM_CORE_CUSTOM_FIELD]: [
            {
              attributes: {
                scriptId: 'a',
                'xsi:type': SOAP_FIELDS_TYPES.BOOLEAN,
              },
              'platformCore:value': false,
            },
          ],
        },
      })
    })
  })
})
