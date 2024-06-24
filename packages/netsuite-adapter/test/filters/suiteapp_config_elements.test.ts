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
import { BuiltinTypes, ElemID, InstanceElement, isField, ObjectType, toChange } from '@salto-io/adapter-api'
import { getConfigTypes } from '../../src/suiteapp_config_elements'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import filterCreator from '../../src/filters/suiteapp_config_elements'
import { NETSUITE, SELECT_OPTION } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('configElements filter', () => {
  const [selectOptionType] = getConfigTypes()
  const configType = SUITEAPP_CONFIG_RECORD_TYPES[0]
  const fieldsDef = [
    {
      id: 'checkboxField',
      label: 'checkboxField',
      type: 'checkbox',
      selectOptions: [],
    },
    {
      id: 'integerField',
      label: 'integerField',
      type: 'integer',
      selectOptions: [],
    },
    {
      id: 'selectField',
      label: 'selectField',
      type: 'select',
      selectOptions: [{ value: '1', text: 'One' }],
    },
    {
      id: 'multiselectField',
      label: 'multiselectField',
      type: 'multiselect',
      selectOptions: [{ value: '1', text: 'One' }],
    },
    {
      id: 'emailField',
      label: 'emailField',
      type: 'email',
      selectOptions: [],
    },
    {
      id: 'textField',
      label: 'textField',
      type: 'text',
      selectOptions: [],
    },
  ]
  const configRecord = {
    configType,
    fieldsDef,
    data: {
      fields: {
        checkboxField: 'T',
        integerField: '100',
        selectField: '1',
        multiselectField: '1\u00052',
        emailField: 'test@salto.io',
        textField: 'ignore',
      },
    },
  }
  let type: ObjectType
  let instance: InstanceElement
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType]),
      annotations: { fieldsDef },
    })
    instance = new InstanceElement(ElemID.CONFIG_NAME, type, { configRecord })
  })

  describe('onFetch', () => {
    it('should transform type', async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([selectOptionType, type])
      expect(isField(type.fields.configType)).toBeTruthy()

      expect(isField(type.fields.checkboxField)).toBeTruthy()
      expect(type.fields.checkboxField.refType.elemID.typeName).toEqual(BuiltinTypes.BOOLEAN.elemID.typeName)
      expect(type.fields.checkboxField.annotations).toEqual({ label: 'checkboxField', type: 'checkbox' })

      expect(isField(type.fields.integerField)).toBeTruthy()
      expect(type.fields.integerField.refType.elemID.typeName).toEqual(BuiltinTypes.NUMBER.elemID.typeName)
      expect(type.fields.integerField.annotations).toEqual({ label: 'integerField', type: 'integer' })

      expect(isField(type.fields.selectField)).toBeTruthy()
      expect(type.fields.selectField.refType.elemID.typeName).toEqual(SELECT_OPTION)
      expect(type.fields.selectField.annotations).toEqual({ label: 'selectField', type: 'select' })

      expect(isField(type.fields.multiselectField)).toBeTruthy()
      expect(type.fields.multiselectField.refType.elemID.typeName).toEqual(expect.stringContaining(SELECT_OPTION))
      expect(type.fields.multiselectField.annotations).toEqual({ label: 'multiselectField', type: 'multiselect' })

      expect(isField(type.fields.emailField)).toBeTruthy()
      expect(type.fields.emailField.refType.elemID.typeName).toEqual(BuiltinTypes.STRING.elemID.typeName)
      expect(type.fields.emailField.annotations).toEqual({ label: 'emailField', type: 'email' })

      expect(isField(type.fields.textField)).toBeFalsy()
      expect(type.annotations).toEqual({})
    })
    it('should transform instance values', async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([selectOptionType, instance, type])
      expect(instance.value).toEqual({
        configType,
        checkboxField: true,
        emailField: 'test@salto.io',
        integerField: 100,
        selectField: { text: 'One', value: '1' },
        multiselectField: [
          { text: 'One', value: '1' },
          { text: '', value: '2' },
        ],
      })
    })
    it('should not transform when missing fieldsDef', async () => {
      type.annotations = {}
      await filterCreator({} as LocalFilterOpts).onFetch?.([selectOptionType, instance, type])
      expect(type.fields).toEqual({})
      expect(instance.value).toEqual({})
    })
    it('should not transform incorrect values', async () => {
      instance.value = {
        configRecord: {
          fieldsDef: [
            {
              id: 'checkboxField',
              label: 'checkboxField',
              type: 'checkbox',
              selectOptions: [],
            },
            {
              id: 'integerField',
              label: 'integerField',
              type: 'integer',
              selectOptions: [],
            },
            {
              id: 'emailField',
              label: 'emailField',
              type: 'email',
              selectOptions: [],
            },
          ],
          data: {
            fields: {
              checkboxField: 'TRUE',
              integerField: 'not_a_number',
              emailField: false,
            },
          },
        },
      }
      await filterCreator({} as LocalFilterOpts).onFetch?.([selectOptionType, instance, type])
      expect(instance.value).toEqual({
        checkboxField: 'TRUE',
        emailField: false,
        integerField: 'not_a_number',
      })
    })
  })

  describe('preDeploy', () => {
    beforeEach(async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([selectOptionType, instance, type])
    })
    it('should transform instance values', async () => {
      instance.value.textField = 'do_not_ignore'
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        configType,
        checkboxField: true,
        emailField: 'test@salto.io',
        integerField: 100,
        selectField: '1',
        multiselectField: '1\u00052',
        textField: 'do_not_ignore',
      })
    })
  })
})
