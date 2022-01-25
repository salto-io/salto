/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import createSalesforceChangeValidator, { changeValidators } from '../src/change_validator'

jest.mock('@salto-io/adapter-utils', () => {
  const actual = jest.requireActual('@salto-io/adapter-utils')
  return {
    ...actual,
    createChangeValidator: jest.fn().mockImplementation(actual.createChangeValidator),
  }
})

describe('createSalesforceChangeValidator', () => {
  afterEach(() => {
    (createChangeValidator as jest.MockedFunction<typeof createChangeValidator>).mockClear()
  })

  describe('with no validator config', () => {
    let validator: ChangeValidator
    beforeEach(() => {
      validator = createSalesforceChangeValidator()
    })
    it('should create a validator', () => {
      expect(validator).toBeDefined()
    })
    it('should create a validator will all internal validators enabled', () => {
      expect(createChangeValidator).toHaveBeenCalledWith(Object.values(changeValidators), [])
    })
  })

  describe('with a disabled validator config', () => {
    let validator: ChangeValidator
    beforeEach(() => {
      validator = createSalesforceChangeValidator({ customFieldType: false })
    })
    it('should create a validator', () => {
      expect(validator).toBeDefined()
    })
    it('should put the disabled validator in the disabled list', () => {
      const enabledValidators = Object.values(_.omit(changeValidators, 'customFieldType'))
      const disabledValidators = [changeValidators.customFieldType]
      expect(createChangeValidator).toHaveBeenCalledWith(enabledValidators, disabledValidators)
    })
  })
})
