/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import subInstancesValidator from '../../src/change_validators/subinstances'
import { NETSUITE } from '../../src/constants'
import { mockChangeValidatorParams } from '../utils'

describe('subInstances change validator', () => {
  describe('should have change error if a sub-instance has been modified', () => {
    let accountingPeriodType: ObjectType
    let accountingPeriodInstance: InstanceElement

    beforeEach(() => {
      accountingPeriodType = new ObjectType({ elemID: new ElemID(NETSUITE, 'AccountingPeriod') })
      accountingPeriodInstance = new InstanceElement('instance', accountingPeriodType, { isSubInstance: true })
    })
    it('removal', async () => {
      const changeErrors = await subInstancesValidator(
        [toChange({ before: accountingPeriodInstance })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })

    it('modification', async () => {
      const after = accountingPeriodInstance.clone()
      after.value.isSubInstance = false
      const changeErrors = await subInstancesValidator(
        [toChange({ before: accountingPeriodInstance, after })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })

    it('addition', async () => {
      const changeErrors = await subInstancesValidator(
        [toChange({ after: accountingPeriodInstance })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })
  })
})
