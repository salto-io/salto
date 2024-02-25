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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import createSalesforceChangeValidator, {
  changeValidators,
  defaultChangeValidatorsDeployConfig,
  defaultChangeValidatorsValidateConfig,
} from '../src/change_validator'
import mockAdapter from './adapter'
import SalesforceClient from '../src/client/client'

const { createChangeValidator } = deployment.changeValidators

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      changeValidators: {
        ...actual.deployment.changeValidators,
        createChangeValidator: jest
          .fn()
          .mockImplementation(
            actual.deployment.changeValidators.createChangeValidator,
          ),
      },
    },
  }
})

describe('createSalesforceChangeValidator', () => {
  let createChangeValidatorMock: jest.MockedFunction<
    typeof createChangeValidator
  >
  let validator: ChangeValidator
  let client: SalesforceClient

  beforeEach(() => {
    createChangeValidatorMock =
      createChangeValidator as typeof createChangeValidatorMock
    createChangeValidatorMock.mockClear()
    const adapter = mockAdapter({})
    client = adapter.client
  })

  describe('when checkOnly is false', () => {
    describe('with no validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({
          config: {},
          isSandbox: false,
          checkOnly: false,
          client,
        })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should create a validator with all internal validators enabled', () => {
        const enabledValidatorsCount =
          Object.entries(changeValidators).filter(
            ([name]) => defaultChangeValidatorsDeployConfig[name] !== false,
          ).length +
          Object.entries(
            deployment.changeValidators.getDefaultChangeValidators(),
          ).length

        expect(createChangeValidator).toHaveBeenCalledTimes(1)
        expect(
          Object.keys(createChangeValidatorMock.mock.calls[0][0].validators),
        ).toHaveLength(enabledValidatorsCount)
        expect(
          createChangeValidatorMock.mock.calls[0][0].validatorsActivationConfig,
        ).toMatchObject(defaultChangeValidatorsDeployConfig)
      })
    })
    describe('with a disabled validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({
          config: {
            deploy: {
              changeValidators: {
                customFieldType: false,
              },
            },
          },
          isSandbox: false,
          checkOnly: false,
          client,
        })
      })
      it('should create a validator', () => {
        expect(validator).toBeDefined()
      })
      it('should customFieldType in the disabled validator list', () => {
        expect(createChangeValidator).toHaveBeenCalledTimes(1)
        expect(
          createChangeValidatorMock.mock.calls[0][0].validatorsActivationConfig,
        ).toMatchObject({
          customFieldType: false,
          ...defaultChangeValidatorsDeployConfig,
        })
      })
    })
    // Remove as part of SALTO-2700
    describe('with checkOnly defined in the client deploy config', () => {
      const createValidatorWithConfig = (checkOnly: boolean): ChangeValidator =>
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
      describe('when checkOnly is true in the deploy config', () => {
        it('should create validator according to the validate default config', () => {
          validator = createValidatorWithConfig(true)
          expect(validator).toBeDefined()
          expect(
            createChangeValidatorMock.mock.calls[0][0]
              .validatorsActivationConfig,
          ).toMatchObject(defaultChangeValidatorsValidateConfig)
        })
      })
      describe('when checkOnly is false in the deploy config', () => {
        it('should create validator according to the deploy default config', () => {
          validator = createValidatorWithConfig(false)
          expect(validator).toBeDefined()
          expect(
            createChangeValidatorMock.mock.calls[0][0]
              .validatorsActivationConfig,
          ).toMatchObject(defaultChangeValidatorsDeployConfig)
        })
      })
    })
  })
  describe('when checkOnly is true', () => {
    describe('with no validator config', () => {
      beforeEach(() => {
        validator = createSalesforceChangeValidator({
          config: {},
          isSandbox: false,
          checkOnly: true,
          client,
        })
      })
      it('should create validator according to the validate default config', () => {
        const enabledValidatorsCount =
          Object.entries(changeValidators).filter(
            ([name]) => defaultChangeValidatorsValidateConfig[name] !== false,
          ).length +
          Object.entries(
            deployment.changeValidators.getDefaultChangeValidators(),
          ).length

        expect(createChangeValidator).toHaveBeenCalledTimes(1)
        expect(
          Object.keys(createChangeValidatorMock.mock.calls[0][0].validators),
        ).toHaveLength(enabledValidatorsCount)
        expect(
          createChangeValidatorMock.mock.calls[0][0].validatorsActivationConfig,
        ).toMatchObject(defaultChangeValidatorsValidateConfig)
      })
    })
  })
  it('should include the default change validators from core', () => {
    expect(changeValidators).toContainKeys(
      Object.keys(deployment.changeValidators.getDefaultChangeValidators()),
    )
  })
})
