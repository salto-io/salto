/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, Field, ObjectType, toChange } from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import standardFieldLabelValidator from '../../src/change_validators/standard_field_label'
import { CUSTOM_OBJECT, LABEL } from '../../src/constants'
import { createField } from '../utils'

describe('standard field label modification change validator', () => {
  describe('onUpdate', () => {
    let afterField: Field
    let beforeField: Field
    let customObj: ObjectType
    beforeAll(() => {
      customObj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
        annotations: { metadataType: CUSTOM_OBJECT, apiName: 'obj__c' },
      })
      beforeField = createField(customObj, Types.primitiveDataTypes.Text, 'Something', { [LABEL]: 'testLabel' })
    })
    beforeEach(() => {
      afterField = beforeField.clone()
    })

    const runChangeValidator = (before: Field | undefined, after: Field): Promise<ReadonlyArray<ChangeError>> =>
      standardFieldLabelValidator([toChange({ before, after })])

    it('should have Error for standard field label modification', async () => {
      afterField.annotations[LABEL] = 'differentLabel'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have no errors for custom field label modification', async () => {
      beforeField.name = 'field__c' // make it a custom field
      afterField = beforeField.clone()
      afterField.annotations[LABEL] = 'differentLabel'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no errors for modification of different annotations in standard field', async () => {
      afterField.annotations.modifyMe = 'modified'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await standardFieldLabelValidator([
        toChange({ before: customObj, after: customObj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
