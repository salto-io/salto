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
  BuiltinTypes,
  Change,
  ChangeValidator,
  Field,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'
import creator from '../../src/change_validators/new_fields_and_objects_fls'
import { API_NAME, DEFAULT_FLS_PROFILES } from '../../src/constants'

describe('new Fields and Objects FLS Change Validator', () => {
  let addedField: Field
  let addedObject: ObjectType
  let changes: Change[]
  let changeValidator: ChangeValidator

  beforeEach(() => {
    addedField = new Field(
      mockTypes.Account,
      'TestField__c',
      BuiltinTypes.STRING,
      { [API_NAME]: 'Account.TestField__c' },
    )
    addedObject = createCustomObjectType('TestType__c', {
      annotations: { [API_NAME]: 'TestType__c' },
    })
    changes = [addedField, addedObject].map((element) =>
      toChange({ after: element }),
    )
  })

  describe('when flsProfiles are defined in the config', () => {
    const CUSTOM_FLS_PROFILES = ['Test Profile', 'Another Test Profile']
    beforeEach(() => {
      changeValidator = creator({
        client: { deploy: { flsProfiles: CUSTOM_FLS_PROFILES } },
      })
    })

    it('should return correct change infos', async () => {
      const changeErrors = await changeValidator(changes)
      expect(changeErrors).toHaveLength(2)
      const [fieldError, objectError] = changeErrors
      expect(fieldError).toEqual({
        elemID: addedField.elemID,
        severity: 'Info',
        message: expect.stringContaining('CustomField visibility'),
        detailedMessage: expect.stringContaining(
          CUSTOM_FLS_PROFILES.join(', '),
        ),
      })
      expect(objectError).toEqual({
        elemID: addedObject.elemID,
        severity: 'Info',
        message: expect.stringContaining('CustomObject visibility'),
        detailedMessage: expect.stringContaining(
          CUSTOM_FLS_PROFILES.join(', '),
        ),
      })
    })
  })

  describe('when flsProfiles are not defined in the config', () => {
    beforeEach(() => {
      changeValidator = creator({})
    })

    it('should return correct change infos', async () => {
      const changeErrors = await changeValidator(changes)
      expect(changeErrors).toHaveLength(2)
      const [fieldError, objectError] = changeErrors
      expect(fieldError).toEqual({
        elemID: addedField.elemID,
        severity: 'Info',
        message: expect.stringContaining('CustomField visibility'),
        detailedMessage: expect.stringContaining(
          DEFAULT_FLS_PROFILES.join(', '),
        ),
      })
      expect(objectError).toEqual({
        elemID: addedObject.elemID,
        severity: 'Info',
        message: expect.stringContaining('CustomObject visibility'),
        detailedMessage: expect.stringContaining(
          DEFAULT_FLS_PROFILES.join(', '),
        ),
      })
    })
  })
})
