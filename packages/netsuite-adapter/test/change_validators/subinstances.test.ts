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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import subInstancesValidator from '../../src/change_validators/subinstances'
import { NETSUITE } from '../../src/constants'

describe('subInstances change validator', () => {
  describe('should have change error if a sub-instance has been modified', () => {
    let accountingPeriodType: ObjectType
    let accountingPeriodInstance: InstanceElement

    beforeEach(() => {
      accountingPeriodType = new ObjectType({ elemID: new ElemID(NETSUITE, 'AccountingPeriod') })
      accountingPeriodInstance = new InstanceElement('instance', accountingPeriodType, { isSubInstance: true })
    })
    it('removal', async () => {
      const changeErrors = await subInstancesValidator([toChange({ before: accountingPeriodInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })

    it('modification', async () => {
      const after = accountingPeriodInstance.clone()
      after.value.isSubInstance = false
      const changeErrors = await subInstancesValidator([toChange({ before: accountingPeriodInstance, after })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })

    it('addition', async () => {
      const changeErrors = await subInstancesValidator([toChange({ after: accountingPeriodInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(accountingPeriodInstance.elemID)
    })
  })
})
