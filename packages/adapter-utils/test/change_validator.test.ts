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

import { ChangeValidator, ChangeError, ObjectType, ElemID, Change } from '@salto-io/adapter-api'
import { createChangeValidator } from '../src/change_validator'
import { mockFunction, MockFunction, toChange } from './common'

describe('change_validator', () => {
  const testElem = new ObjectType({ elemID: new ElemID('test', 'type') })

  let mockValidators: MockFunction<ChangeValidator>[]
  let changes: ReadonlyArray<Change>
  let errors: ChangeError[]
  let result: ReadonlyArray<ChangeError>

  beforeEach(async () => {
    errors = [
      {
        elemID: testElem.elemID,
        severity: 'Error',
        message: 'test',
        detailedMessage: 'test',
      },
      {
        elemID: testElem.elemID,
        severity: 'Error',
        message: 'test2',
        detailedMessage: 'test2',
      },
    ]
    mockValidators = [
      mockFunction<ChangeValidator>().mockResolvedValue(errors.slice(0, 1)),
      mockFunction<ChangeValidator>().mockResolvedValue(errors.slice(1)),
    ]
    changes = [toChange({ after: testElem })]
    const mainValidator = createChangeValidator(mockValidators)
    result = await mainValidator(changes)
  })

  it('should call all validators', () => {
    mockValidators.forEach(
      validator => expect(validator).toHaveBeenCalledWith(changes)
    )
  })

  it('should return errors from all validators', () => {
    expect(result).toEqual(errors)
  })
})
