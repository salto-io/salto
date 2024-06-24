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
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../src/types'
import { NETSUITE, SETTINGS_PATH } from '../src/constants'
import * as unit from '../src/suiteapp_config_elements'
import { NetsuiteQuery } from '../src/config/query'

describe('config elements', () => {
  const configType = SUITEAPP_CONFIG_RECORD_TYPES[0]
  const fieldsDef = [
    { id: 'checkboxField', label: 'checkboxField', type: 'checkbox', selectOptions: [] },
    { id: 'integerField', label: 'integerField', type: 'integer', selectOptions: [] },
    { id: 'selectField', label: 'selectField', type: 'select', selectOptions: [] },
    { id: 'multiselectField', label: 'multiselectField', type: 'multiselect', selectOptions: [] },
    { id: 'emailField', label: 'emailField', type: 'email', selectOptions: [] },
    { id: 'textField', label: 'textField', type: 'text', selectOptions: [] },
  ]
  const configRecord = {
    configType,
    fieldsDef,
    data: { fields: {} },
  }

  const fetchQuery = {
    isTypeMatch: jest.fn().mockResolvedValue(true),
  } as unknown as NetsuiteQuery
  const elements = unit.toConfigElements([configRecord], fetchQuery)

  describe('getConfigRecordElements', () => {
    it('should return correct length of elements', () => {
      expect(elements.length).toBe(2)
    })
    it('should create config ObjectType', () => {
      const configObjectType = elements[0]
      expect(isObjectType(configObjectType)).toBeTruthy()
      expect(configObjectType.elemID.typeName).toEqual(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType])
      expect(configObjectType.annotations).toEqual({ fieldsDef })
    })
    it('should create config Instance', () => {
      const configInstance = elements[1]
      expect(isInstanceElement(configInstance)).toBeTruthy()
      expect(configInstance.elemID.typeName).toEqual(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType])
      expect(isInstanceElement(configInstance) && configInstance.value).toEqual({ configRecord })
      expect(configInstance.path).toEqual([NETSUITE, SETTINGS_PATH, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType]])
    })
  })
  describe('deploy', () => {
    const types = elements.filter(isObjectType)
    const changes = [
      toChange({
        before: new InstanceElement('_config', types[0], {
          checkboxField: false,
          integerField: 1,
          configType,
        }),
        after: new InstanceElement('_config', types[0], {
          checkboxField: true,
          integerField: 1,
          configType,
        }),
      }) as ModificationChange<InstanceElement>,
    ]
    describe('getSetConfigTypes', () => {
      it('should return result', () => {
        expect(unit.toSetConfigTypes(changes)).toEqual([
          {
            configType,
            items: [{ fieldId: 'checkboxField', value: true }],
          },
        ])
      })
    })
    describe('getConfigDeployResult', () => {
      it('should return error on error results', () => {
        expect(unit.toConfigDeployResult(changes, { errorMessage: 'error' })).toEqual({
          errors: [{ message: 'error', severity: 'Error' }],
          appliedChanges: [],
        })
      })
      it('should return error on no results', () => {
        expect(unit.toConfigDeployResult(changes, [])).toEqual({
          errors: [
            {
              elemID: getChangeData(changes[0]).elemID,
              message: 'Failed to deploy instance due to internal server error',
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
      })
      it('should return error on fail results', () => {
        expect(unit.toConfigDeployResult(changes, [{ configType, status: 'fail', errorMessage: 'fail' }])).toEqual({
          errors: [
            {
              elemID: getChangeData(changes[0]).elemID,
              message: `${configType}: fail`,
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
      })
      it('should return appliedChanges on success', () => {
        expect(unit.toConfigDeployResult(changes, [{ configType, status: 'success' }])).toEqual({
          appliedChanges: changes,
          errors: [],
        })
      })
    })
  })
})
