/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, InstanceElement, isField, isInstanceElement, isObjectType, ModificationChange, toChange } from '@salto-io/adapter-api'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { NETSUITE, SELECT_OPTION, SETTINGS_PATH } from '../../src/constants'
import * as unit from '../../src/client/suiteapp_client/config_elements'

describe('config elements', () => {
  const configType = SUITEAPP_CONFIG_RECORD_TYPES[0]
  const configRecord = {
    configType,
    fieldsDef: [
      { id: 'checkboxField', label: 'checkboxField', type: 'checkbox', selectOptions: [] },
      { id: 'integerField', label: 'integerField', type: 'integer', selectOptions: [] },
      { id: 'selectField', label: 'selectField', type: 'select', selectOptions: [] },
      { id: 'multiselectField', label: 'multiselectField', type: 'multiselect', selectOptions: [] },
      { id: 'emailField', label: 'emailField', type: 'email', selectOptions: [] },
      { id: 'textField', label: 'textField', type: 'text', selectOptions: [] },
    ],
    data: { fields: {} },
  }
  const elements = unit.getConfigRecordElements([configRecord])
  describe('getConfigRecordElements', () => {
    it('should return correct length of elements', () => {
      // configType + configInstance + selectOptionType
      expect(elements.length).toBe(3)
    })
    it('should create config ObjectType', () => {
      const configObjectType = elements[0]
      expect(isObjectType(configObjectType)).toBeTruthy()
      expect(configObjectType.elemID.typeName)
        .toEqual(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType])

      const fields = isObjectType(configObjectType) ? configObjectType.fields : {}
      expect(isField(fields.configType)).toBeTruthy()

      expect(isField(fields.checkboxField)).toBeTruthy()
      expect(fields.checkboxField.refType.elemID.typeName)
        .toEqual(BuiltinTypes.BOOLEAN.elemID.typeName)
      expect(fields.checkboxField.annotations).toEqual({ label: 'checkboxField', type: 'checkbox' })

      expect(isField(fields.integerField)).toBeTruthy()
      expect(fields.integerField.refType.elemID.typeName)
        .toEqual(BuiltinTypes.NUMBER.elemID.typeName)
      expect(fields.integerField.annotations).toEqual({ label: 'integerField', type: 'integer' })

      expect(isField(fields.selectField)).toBeTruthy()
      expect(fields.selectField.refType.elemID.typeName).toEqual(SELECT_OPTION)
      expect(fields.selectField.annotations).toEqual({ label: 'selectField', type: 'select' })

      expect(isField(fields.multiselectField)).toBeTruthy()
      expect(fields.multiselectField.refType.elemID.typeName)
        .toEqual(expect.stringContaining(SELECT_OPTION))
      expect(fields.multiselectField.annotations).toEqual({ label: 'multiselectField', type: 'multiselect' })

      expect(isField(fields.emailField)).toBeTruthy()
      expect(fields.emailField.refType.elemID.typeName).toEqual(BuiltinTypes.STRING.elemID.typeName)
      expect(fields.emailField.annotations).toEqual({ label: 'emailField', type: 'email' })

      expect(isField(fields.textField)).toBeFalsy()
    })
    it('should create config Instance', () => {
      const configInstance = elements[1]
      expect(isInstanceElement(configInstance)).toBeTruthy()
      expect(configInstance.elemID.typeName)
        .toEqual(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType])
      expect(isInstanceElement(configInstance) && configInstance.value).toEqual({ configRecord })
      expect(configInstance.path)
        .toEqual([NETSUITE, SETTINGS_PATH, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType]])
    })
    it('should create selectOption ObjectType', () => {
      const selectOptionType = elements[2]
      expect(isObjectType(selectOptionType)).toBeTruthy()
      expect(selectOptionType.elemID.typeName).toEqual(SELECT_OPTION)
      const fields = isObjectType(selectOptionType) ? selectOptionType.fields : {}
      expect(isField(fields.value)).toBeTruthy()
      expect(isField(fields.text)).toBeTruthy()
    })
  })
  describe('deploy', () => {
    const types = elements.filter(isObjectType)
    const changes = [
      toChange({
        before: new InstanceElement(
          '_config',
          types[0],
          {
            checkboxField: false,
            integerField: 1,
            configType,
          }
        ),
        after: new InstanceElement(
          '_config',
          types[0],
          {
            checkboxField: true,
            integerField: 1,
            configType,
          }
        ),
      }) as ModificationChange<InstanceElement>,
    ]
    describe('getSetConfigTypes', () => {
      it('should return result', () => {
        expect(unit.getSetConfigTypes(changes)).toEqual([{
          configType,
          items: [{ fieldId: 'checkboxField', value: true }],
        }])
      })
    })
    describe('getConfigDeployResult', () => {
      it('should return error on error results', () => {
        expect(unit.getConfigDeployResult(changes, { errorMessage: 'error' }))
          .toEqual({ errors: [new Error('error')], appliedChanges: [] })
      })
      it('should return error on no results', () => {
        expect(unit.getConfigDeployResult(changes, []))
          .toEqual({ errors: [new Error('Missing deploy result for some changes')], appliedChanges: [] })
      })
      it('should return error on fail results', () => {
        expect(unit.getConfigDeployResult(changes, [{ configType, status: 'fail', errorMessage: 'fail' }]))
          .toEqual({ errors: [new Error(`${configType}: fail`)], appliedChanges: [] })
      })
      it('should return appliedChanges on success', () => {
        expect(unit.getConfigDeployResult(changes, [{ configType, status: 'success' }]))
          .toEqual({ appliedChanges: changes, errors: [] })
      })
    })
  })
})
