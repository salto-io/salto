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
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import createSalesforceChangeValidator, { changeValidators } from '../src/change_validator'
import mockAdapter from './adapter'
import SalesforceClient from '../src/client/client'

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
  let client: SalesforceClient

  beforeEach(() => {
    createChangeValidatorMock = createChangeValidator as typeof createChangeValidatorMock
    createChangeValidatorMock.mockClear()
    const adapter = mockAdapter({})
    client = adapter.client
  })

  describe('when checkOnly is false', () => {
    describe('with no validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({ config: {},
          isSandbox: false,
          checkOnly: false,
          client })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should create a validator with all internal validators enabled', () => {
        expect(createChangeValidator).toHaveBeenCalledTimes(1)
        expect(
          createChangeValidatorMock.mock.calls[0][0]
        ).toHaveLength(Object.values(changeValidators).filter(cv => cv.defaultInDeploy).length)
      })
    })
    describe('with a disabled validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({
          config: { validators:
                { customFieldType: false } },
          isSandbox: false,
          checkOnly: false,
          client,
        })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should customFieldType in the disabled validator list', () => {
        const disabledValidators = [changeValidators.customFieldType.creator({}, false, client)]
        expect(createChangeValidator).toHaveBeenCalledWith(
          expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => cv.defaultInDeploy).length - 1),
          disabledValidators
        )
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
          isSandbox: false,
          checkOnly: false,
          client,
        })
      )
      describe('when checkOnly is true in the deploy config', () => {
        it('should create validator according to the defaultInValidate field', () => {
          validator = createValidatorWithConfig(true)
          expect(validator).toBeDefined()
          expect(createChangeValidator).toHaveBeenCalledWith(
            expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => cv.defaultInValidate).length),
            expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => !cv.defaultInValidate).length)
          )
        })
      })
      describe('when checkOnly is false in the deploy config', () => {
        it('should create validator according to the defaultInDeploy field', () => {
          validator = createValidatorWithConfig(false)
          expect(validator).toBeDefined()
          expect(createChangeValidator).toHaveBeenCalledWith(
            expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => cv.defaultInDeploy).length),
            []
          )
        })
      })
    })
  })
  describe('when checkOnly is true', () => {
    beforeEach(() => {
      validator = createSalesforceChangeValidator({
        config: {},
        isSandbox: false,
        checkOnly: true,
        client,
      })
    })
    it('should create validator according to the defaultInValidate field', () => {
      expect(validator).toBeDefined()
      expect(createChangeValidator).toHaveBeenCalledWith(
        expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => cv.defaultInValidate).length),
        expect.toBeArrayOfSize(Object.values(changeValidators).filter(cv => !cv.defaultInValidate).length)
      )
    })
  })
})
