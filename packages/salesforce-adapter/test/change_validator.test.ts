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
  let createChangeValidatorMock: jest.MockedFunction<typeof createChangeValidator>
  let validator: ChangeValidator
  beforeEach(() => {
    createChangeValidatorMock = createChangeValidator as typeof createChangeValidatorMock
    createChangeValidatorMock.mockClear()
  })

  describe('when checkOnly is false', () => {
    describe('with no validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({ config: {}, checkOnly: false })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should create a validator will all internal validators enabled', () => {
        expect(createChangeValidator).toHaveBeenCalledTimes(1)
        expect(
          createChangeValidatorMock.mock.calls[0][0]
        ).toHaveLength(Object.values(changeValidators).length)
      })
    })
    describe('with a disabled validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({
          config: { validators: { customFieldType: false } },
          checkOnly: false,
        })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should put the disabled validator in the disabled list', () => {
        const enabledValidatorsCount = Object.values(_.omit(changeValidators, 'customFieldType')).length
        const disabledValidators = [changeValidators.customFieldType({})]
        expect(createChangeValidator).toHaveBeenCalledWith(
          expect.arrayContaining([]), disabledValidators
        )
        expect(createChangeValidatorMock.mock.calls[0][0]).toHaveLength(enabledValidatorsCount)
      })
    })
    // Remove as part of SALTO-2700
    describe('with checkOnly defined in the client deploy config', () => {
      const createValidatorWithConfig = (checkOnly: boolean): ChangeValidator => (
        createSalesforceChangeValidator({
          config: {
            client: {
              deploy: {
                checkOnly,
              },
            },
          },
          checkOnly: false,
        })
      )
      describe('when checkOnly is true in the deploy config', () => {
        it('should create validator with the extra checkOnlyValidator', () => {
          validator = createValidatorWithConfig(true)
          expect(validator).toBeDefined()
          expect(createChangeValidator).toHaveBeenCalledWith(
            expect.toBeArrayOfSize(Object.keys(changeValidators).length + 1), []
          )
        })
      })
      describe('when checkOnly is false in the deploy config', () => {
        it('should create validator without the extra checkOnlyValidator', () => {
          validator = createValidatorWithConfig(false)
          expect(validator).toBeDefined()
          expect(createChangeValidator).toHaveBeenCalledWith(
            expect.toBeArrayOfSize(Object.keys(changeValidators).length), []
          )
        })
      })
    })
  })
  describe('when checkOnly is true', () => {
    beforeEach(() => {
      validator = createSalesforceChangeValidator({
        config: {},
        checkOnly: true,
      })
    })
    it('should create a validator with the extra checkOnlyValidator', () => {
      expect(validator).toBeDefined()
      expect(createChangeValidator).toHaveBeenCalledWith(
        expect.toBeArrayOfSize(Object.keys(changeValidators).length + 1), []
      )
    })
  })
})
