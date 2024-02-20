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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { fileType } from '../../src/types/file_cabinet_types'
import { usereventscriptType } from '../../src/autogen/types/standard_types/usereventscript'
import accountSpecificValueValidator from '../../src/change_validators/account_specific_values'
import { ACCOUNT_SPECIFIC_VALUE, PATH, SCRIPT_ID } from '../../src/constants'

describe('account specific value validator', () => {
  const origInstance = new InstanceElement('instance', usereventscriptType().type, {
    isinactive: false,
    [SCRIPT_ID]: 'customscript1',
    name: 'ScriptName',
  })
  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should not have ChangeError when deploying a file cabinet instance', async () => {
    const newFileInstance = new InstanceElement('instance', fileType(), {
      [PATH]: '/Path/to/file',
      content: ACCOUNT_SPECIFIC_VALUE,
    })
    const changeErrors = await accountSpecificValueValidator([toChange({ after: newFileInstance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have ChangeError when deploying an instance without ACCOUNT_SPECIFIC_VALUE', async () => {
    const after = instance.clone()
    after.value.name = 'NewName'
    const changeErrors = await accountSpecificValueValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should have Warning ChangeError when modifying an instance with ACCOUNT_SPECIFIC_VALUE', async () => {
    const after = instance.clone()
    after.value.name = ACCOUNT_SPECIFIC_VALUE
    const changeErrors = await accountSpecificValueValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })

  it('should have Warning ChangeError when modifying an instance with value that includes ACCOUNT_SPECIFIC_VALUE', async () => {
    const after = instance.clone()
    after.value.name = `${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}`
    const changeErrors = await accountSpecificValueValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })
})
