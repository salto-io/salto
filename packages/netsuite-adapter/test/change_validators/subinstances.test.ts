/*
*                      Copyright 2021 Salto Labs Ltd.
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
  it('should have change error if a sub-instance has been modified', async () => {
    const accountingPeriodType = new ObjectType({ elemID: new ElemID(NETSUITE, 'AccountingPeriod') })
    const before = new InstanceElement('instance', accountingPeriodType, { isSubInstance: true })

    const changeErrors = await subInstancesValidator(
      [toChange({ before })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(before.elemID)
  })
})
