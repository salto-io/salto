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
import instanceChangesValidator from '../../src/change_validators/instance_changes'
import { customTypes } from '../../src/types'
import { ENTITY_CUSTOM_FIELD, SCRIPT_ID } from '../../src/constants'
import { toChange } from '../utils'


describe('customization type change validator', () => {
  it('should have change error if custom type SCRIPT_ID has been modified', async () => {
    const after = customTypes[ENTITY_CUSTOM_FIELD].clone()
    after.fields[SCRIPT_ID].annotate({ dummyKey: 'dummyValue' })
    const changeErrors = await instanceChangesValidator(
      [toChange({ before: customTypes[ENTITY_CUSTOM_FIELD], after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })
})
