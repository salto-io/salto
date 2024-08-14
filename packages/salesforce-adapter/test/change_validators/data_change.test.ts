/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, Change, InstanceElement, toChange, getChangeData } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/data_change'
import { mockTypes } from '../mock_elements'

describe('dataChange ChangeValidator', () => {
  let changeErrors: ReadonlyArray<ChangeError>
  describe('with data instance change with no unknown fields values', () => {
    let change: Change
    beforeEach(async () => {
      const beforeCustomObjInstance = new InstanceElement('customObjInstance', mockTypes.Product2, {
        ProductCode: 'beforeValue',
      })
      const afterCustomObjInstance = beforeCustomObjInstance.clone()
      afterCustomObjInstance.value.ProductCode = 'afterValue'
      change = toChange({
        before: beforeCustomObjInstance,
        after: afterCustomObjInstance,
      })
      changeErrors = await changeValidator([change])
    })
    it('should create a ChangeError with severity Info', async () => {
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: getChangeData(change).elemID,
          severity: 'Info',
        }),
      ])
    })
  })

  describe('with data instance change with unknown fields values', () => {
    let change: Change
    beforeEach(async () => {
      const beforeCustomObjInstance = new InstanceElement('customObjInstance', mockTypes.Product2, {
        ProductCode: 'beforeValue',
      })
      const afterCustomObjInstance = beforeCustomObjInstance.clone()
      afterCustomObjInstance.value.ProductCode = 'afterValue'
      afterCustomObjInstance.value.UnknownField__c = 'unknownValue'
      change = toChange({
        before: beforeCustomObjInstance,
        after: afterCustomObjInstance,
      })
      changeErrors = await changeValidator([change])
    })
    it('should create a warning', async () => {
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: getChangeData(change).elemID,
          severity: 'Info',
        }),
        expect.objectContaining({
          elemID: getChangeData(change).elemID,
          severity: 'Warning',
          detailedMessage: expect.stringContaining('UnknownField__c'),
        }),
      ])
    })
  })

  describe('with regular instance change', () => {
    beforeEach(async () => {
      const beforeInstance = new InstanceElement('instance', mockTypes.ApexClass, { field: 'beforeValue' })
      const afterInstance = beforeInstance.clone()
      afterInstance.value.field = 'afterValue'
      changeErrors = await changeValidator([toChange({ before: beforeInstance, after: afterInstance })])
    })
    it('should have no errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
