/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { DEFAULT_CHANGE_VALIDATORS } from '../../../src/deployment/change_validators/default_change_validators'
import { getDefaultChangeValidators } from '../../../src/deployment/change_validators'

describe('default_change_validators', () => {
  it('should omit validators in validatorsToOmit', () => {
    const allValidators = getDefaultChangeValidators()
    expect(allValidators).toContain(DEFAULT_CHANGE_VALIDATORS.unresolvedReferencesValidator)
    const validators = getDefaultChangeValidators(['unresolvedReferencesValidator'])
    expect(validators).toHaveLength(allValidators.length - 1)
    expect(validators).not.toContain(DEFAULT_CHANGE_VALIDATORS.unresolvedReferencesValidator)
  })
})
