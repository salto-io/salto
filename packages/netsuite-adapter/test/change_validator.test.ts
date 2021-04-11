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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { fileCabinetTypes } from '../src/types'
import getChangeValidator from '../src/change_validator'

describe('change validator', () => {
  describe('without SuiteApp', () => {
    const changeValidator = getChangeValidator(false)
    it('should have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileCabinetTypes.file)
      const changeErrors = await changeValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })

  describe('with SuiteApp', () => {
    const changeValidator = getChangeValidator(true)
    it('should not have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileCabinetTypes.file)
      const changeErrors = await changeValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
