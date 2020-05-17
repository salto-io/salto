/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement } from '@salto-io/adapter-api'
import readonlyValidator from '../../src/change_validators/readonly'
import { Types } from '../../src/transformers/transformer'
import { OBJECTS_NAMES } from '../../src/constants'
import { afterFormInstanceValuesMock } from '../common/mock_elements'

describe('readonly change validator', () => {
  describe('onUpdate', () => {
    let before: InstanceElement
    beforeEach(() => {
      before = new InstanceElement(
        'formInstance',
        Types.hubspotObjects[OBJECTS_NAMES.FORM],
        afterFormInstanceValuesMock,
      )
    })

    it('should have an error when trying to edit deleteable in Form', async () => {
      const after = before.clone()
      after.value.deletable = 'abc'
      const changeErrors = await readonlyValidator.onUpdate([{
        action: 'modify',
        data: { after, before },
      }])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(after.elemID)
    })

    it('should not have an  error when trying to edit non-readonly', async () => {
      const after = before.clone()
      after.value.ignoreCurrentValues = true
      const changeErrors = await readonlyValidator.onUpdate([{
        action: 'modify',
        data: { after, before },
      }])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
