/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ChangeError, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'
import changeValidator from '../../src/change_validators/cpq_billing_start_date'

describe('CPQ billing StartDateTime', () => {
  let result: ReadonlyArray<ChangeError>
  const objectType = createCustomObjectType('blng__InvoiceScheduler__c', {
    fields: {
      blng__StartDateTime__c: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  describe('When the change is to an instance of an irrelevant type', () => {
    beforeEach(async () => {
      const instance = new InstanceElement('SomeInstance', mockTypes.Account, {})
      result = await changeValidator([toChange({ after: instance })])
    })
    it('should have no errors', () => {
      expect(result).toBeEmpty()
    })
  })
  describe('When the change is to a relevant type rather than an instance', () => {
    beforeEach(async () => {
      result = await changeValidator([toChange({ after: objectType.clone() })])
    })
    it('should have no errors', () => {
      expect(result).toBeEmpty()
    })
  })
  describe('When the date is in the future', () => {
    beforeEach(async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      const instance = new InstanceElement('SomeInvoiceScheduler', objectType, {
        blng__StartDateTime__c: futureDate.toString(),
      })
      result = await changeValidator([toChange({ after: instance })])
    })
    it('should have no errors', () => {
      expect(result).toBeEmpty()
    })
  })
  describe('When the date is in the past', () => {
    beforeEach(async () => {
      const instance = new InstanceElement('SomeInvoiceScheduler', objectType, {
        blng__StartDateTime__c: '2024-06-13T16:00:00.000+0000',
      })
      result = await changeValidator([toChange({ after: instance })])
    })
    it('should have an error', () => {
      expect(result).toHaveLength(1)
      expect(result[0]).toSatisfy(
        error =>
          error.elemID.isEqual(objectType.elemID.createNestedID('instance', 'SomeInvoiceScheduler')) &&
          error.severity === 'Error' &&
          error.message.includes('blng__InvoiceScheduler__c'),
      )
    })
  })
})
