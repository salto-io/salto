/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import recordTypeChangeValidator from '../../src/change_validators/record_type_deletion'
import { CUSTOM_OBJECT } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('record type deletion change validator', () => {
  const objectType = new ObjectType({
    elemID: new ElemID('salesforce', 'obj__c', 'type'),
    annotations: { metadataType: CUSTOM_OBJECT, apiName: 'obj__c' },
  })

  const beforeRecord = createInstanceElement({ fullName: 'obj__c.record' }, mockTypes.RecordType)

  describe('deletion of record type without the deletion of the type', () => {
    it('should have error when trying to remove record type', async () => {
      const changeErrors = await recordTypeChangeValidator([toChange({ before: beforeRecord })])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeRecord.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('deletion of record type with the deletion of the type', () => {
    it('should have no errors', async () => {
      const changeErrors = await recordTypeChangeValidator([
        toChange({ before: objectType }),
        toChange({ before: beforeRecord }),
      ])
      expect(changeErrors).toBeEmpty()
    })
  })
})
