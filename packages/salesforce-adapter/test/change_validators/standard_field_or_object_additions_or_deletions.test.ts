/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import changeValidator from '../../src/change_validators/standard_field_or_object_additions_or_deletions'

describe('standardCustomFieldOrObject Change Validator', () => {
  describe('Addition or removal of standard object', () => {
    it('should have error for standard object addition', async () => {
      // A real scenario of CustomObject addition will also include addition of each of its fields
      const changeErrors = await changeValidator([
        toChange({ after: mockTypes.Account }),
        ...Object.values(mockTypes.Account.fields).map(field => toChange({ after: field })),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: mockTypes.Account.elemID,
          severity: 'Error',
        }),
      ])
    })

    it('should have error for standard object removals', async () => {
      // A real scenario of CustomObject removal will also include removal of each of its fields
      const changeErrors = await changeValidator([
        toChange({ before: mockTypes.Account }),
        ...Object.values(mockTypes.Account.fields).map(field => toChange({ before: field })),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: mockTypes.Account.elemID,
          severity: 'Error',
        }),
      ])
    })
  })
  describe('Addition or removal of custom object', () => {
    it('should not have error for custom object addition', async () => {
      // A real scenario of CustomObject addition will also include addition of each of its fields
      const changeErrors = await changeValidator([
        toChange({ after: mockTypes.TestCustomObject__c }),
        ...Object.values(mockTypes.TestCustomObject__c.fields).map(field => toChange({ after: field })),
      ])
      expect(changeErrors).toBeEmpty()
    })

    it('should not have error for custom object removals', async () => {
      // A real scenario of CustomObject removal will also include removal of each of its fields
      const changeErrors = await changeValidator([
        toChange({ before: mockTypes.TestCustomObject__c }),
        ...Object.values(mockTypes.TestCustomObject__c.fields).map(field => toChange({ before: field })),
      ])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('Addition or removal of custom event', () => {
    it('should not have error for custom event addition', async () => {
      const changeErrors = await changeValidator([toChange({ after: mockTypes.TestCustomEvent__e })])
      expect(changeErrors).toBeEmpty()
    })

    it('should not have error for custom event removals', async () => {
      const changeErrors = await changeValidator([toChange({ before: mockTypes.TestCustomEvent__e })])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('Addition or removal of standard field', () => {
    it('should have error for standard field additions', async () => {
      const standardFieldAdditionChange = toChange({
        after: mockTypes.Account.fields.Name,
      })
      const changeErrors = await changeValidator([standardFieldAdditionChange])
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: mockTypes.Account.fields.Name.elemID,
          severity: 'Error',
        }),
      ])
    })

    it('should have error for standard field removals', async () => {
      const standardFieldRemovalChange = toChange({
        before: mockTypes.Account.fields.Name,
      })
      const changeErrors = await changeValidator([standardFieldRemovalChange])
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: mockTypes.Account.fields.Name.elemID,
          severity: 'Error',
        }),
      ])
    })
  })
})
