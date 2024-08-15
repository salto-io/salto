/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, Change, ChangeValidator, Field, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createCustomMetadataType, createCustomObjectType } from '../utils'
import creator from '../../src/change_validators/new_fields_and_objects_fls'
import { API_NAME, DEFAULT_FLS_PROFILES } from '../../src/constants'

describe('new Fields and Objects FLS Change Validator', () => {
  let addedField: Field
  let addedObject: ObjectType
  let changes: Change[]
  let changeValidator: ChangeValidator

  beforeEach(() => {
    addedField = new Field(mockTypes.Account, 'TestField__c', BuiltinTypes.STRING, {
      [API_NAME]: 'Account.TestField__c',
    })
    addedObject = createCustomObjectType('TestType__c', {
      annotations: { [API_NAME]: 'TestType__c' },
    })
    // Make sure we don't create info on Field that is added alongside it's parent
    const addedObjectField = new Field(addedObject, 'TestField__c', BuiltinTypes.STRING, {
      [API_NAME]: 'TestType__c.TestField__c',
    })
    changes = [addedField, addedObject, addedObjectField].map(element => toChange({ after: element }))
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
        message: expect.stringContaining('Read/write access to this Custom Field will be granted to 2 profiles'),
        detailedMessage: expect.stringContaining(CUSTOM_FLS_PROFILES.join(', ')),
      })
      expect(objectError).toEqual({
        elemID: addedObject.elemID,
        severity: 'Info',
        message: expect.stringContaining('Read/write access to this Custom Object will be granted to 2 profiles'),
        detailedMessage: expect.stringContaining(CUSTOM_FLS_PROFILES.join(', ')),
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
        message: expect.stringContaining(
          'Read/write access to this Custom Field will be granted to the following profile: Admin',
        ),
        detailedMessage: expect.stringContaining(DEFAULT_FLS_PROFILES.join(', ')),
      })
      expect(objectError).toEqual({
        elemID: addedObject.elemID,
        severity: 'Info',
        message: expect.stringContaining(
          'Read/write access to this Custom Object will be granted to the following profile: Admin',
        ),
        detailedMessage: expect.stringContaining(DEFAULT_FLS_PROFILES.join(', ')),
      })
    })

    describe('CustomMetadata object addition', () => {
      beforeEach(() => {
        addedObject = createCustomMetadataType('TestType__mdt', {
          annotations: { [API_NAME]: 'TestType__mdt' },
          fields: {
            TestField__c: { refType: BuiltinTypes.STRING },
          },
        })
        changes = [addedObject, ...Object.values(addedObject.fields)].map(element => toChange({ after: element }))
      })
      it('should create FLS info on the added object only', async () => {
        const errors = await changeValidator(changes)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toEqual({
          elemID: addedObject.elemID,
          severity: 'Info',
          message: expect.stringContaining(
            'Read/write access to this Custom Object will be granted to the following profile: Admin',
          ),
          detailedMessage: expect.stringContaining(DEFAULT_FLS_PROFILES.join(', ')),
        })
      })
    })
  })
})
