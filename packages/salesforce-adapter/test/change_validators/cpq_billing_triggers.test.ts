/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import cpqBillingTriggersChangeValidator from '../../src/change_validators/cpq_billing_triggers'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'
import { BILLING_NAMESPACE } from '../../src/constants'

describe('CPQ Billing Triggers Change Validator', () => {
  let billingMockType: ObjectType

  beforeEach(() => {
    billingMockType = createCustomObjectType(`${BILLING_NAMESPACE}__MockType__c`, {})
  })

  describe("when there's no change of Billing records", () => {
    it('should return no errors', async () => {
      const dataInstance = new InstanceElement('TestInstance', mockTypes.SBQQ__LineColumn__c, {
        Id: '123',
        Name: 'Test',
      })
      const changeErrors = await cpqBillingTriggersChangeValidator([toChange({ after: dataInstance })])
      expect(changeErrors).toBeEmpty()
    })
  })

  describe("when there's a change of Billing records", () => {
    it('should return no errors', async () => {
      const dataInstance = new InstanceElement('TestInstance', billingMockType, { Id: '123', Name: 'Test' })
      const anotherDataInstance = new InstanceElement('AnotherTestInstance', billingMockType, {
        Id: '123',
        Name: 'Test',
      })
      const changeErrors = await cpqBillingTriggersChangeValidator(
        [dataInstance, anotherDataInstance].map(instance => toChange({ after: instance })),
      )
      expect(changeErrors).toHaveLength(1)
    })
  })
})
