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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import {
  ADAPTER_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  ODATA_TYPE_FIELD_NACL_CASE,
  ROLE_DEFINITION_TYPE_NAME,
} from '../../src/constants'
import { requiredFieldsValidator } from '../../src/change_validators'

describe(`${requiredFieldsValidator.name}`, () => {
  describe.each(['addition', 'modification'])(
    `${AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME} with %s change`,
    changeType => {
      it('should return change error for missing required odata type field on %s', async () => {
        const authenticationMethodConfigurationType = new ObjectType({
          elemID: new ElemID(ADAPTER_NAME, AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME),
        })
        const authenticationMethodConfiguration = new InstanceElement(
          'testAuthenticationMethodConfiguration',
          authenticationMethodConfigurationType,
          {
            someOtherField: 'someValue',
          },
        )
        const changes = [
          toChange({
            before: changeType === 'modification' ? authenticationMethodConfiguration.clone() : undefined,
            after: authenticationMethodConfiguration.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual(
          `The following fields _odata_type@mv are missing and required on ${changeType} changes.`,
        )
      })

      it('should not return change error for instance with all required fields on %s', async () => {
        const authenticationMethodConfigurationType = new ObjectType({
          elemID: new ElemID(ADAPTER_NAME, AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME),
        })
        const authenticationMethodConfiguration = new InstanceElement(
          'testAuthenticationMethodConfiguration',
          authenticationMethodConfigurationType,
          {
            [ODATA_TYPE_FIELD_NACL_CASE]: 'someType',
            someOtherField: 'someValue',
          },
        )
        const changes = [
          toChange({
            before: changeType === 'modification' ? authenticationMethodConfiguration.clone() : undefined,
            after: authenticationMethodConfiguration.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes)
        expect(res).toHaveLength(0)
      })
    },
  )

  describe.each(['addition', 'modification'])(
    `${CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME} with %s change`,
    changeType => {
      const INSTANCE_NAME = 'testConditionalAccessPolicyNamedLocation'
      const conditionalAccessPolicyNamedLocationType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME),
      })
      it('when displayName is missing', async () => {
        const conditionalAccessPolicyNamedLocation = new InstanceElement(
          INSTANCE_NAME,
          conditionalAccessPolicyNamedLocationType,
          {
            someOtherField: 'someValue',
          },
        )
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual('The required field displayName is missing')
      })

      it('when displayName is present but odata type is missing', async () => {
        const conditionalAccessPolicyNamedLocation = new InstanceElement(
          INSTANCE_NAME,
          conditionalAccessPolicyNamedLocationType,
          {
            displayName: 'someDisplayName',
            someOtherField: 'someValue',
          },
        )
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual('The required field _odata_type@mv is missing')
      })

      describe('when locationType is ipRange', () => {
        it('when ipRanges field is missing', async () => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.ipNamedLocation',
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(1)
          expect(res[0].detailedMessage).toEqual(
            'The required field ipRanges is missing or has a bad format. Expected Array of objects with fields cidrAddress, _odata_type@mv',
          )
        })

        it.each(['notAnArray', []])('when ipRanges field is not an array or is empty', async val => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.ipNamedLocation',
              ipRanges: val,
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(1)
          expect(res[0].detailedMessage).toEqual(
            'The required field ipRanges is missing or has a bad format. Expected Array of objects with fields cidrAddress, _odata_type@mv',
          )
        })

        it('when ipRanges field is an array but has missing fields', async () => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.ipNamedLocation',
              ipRanges: [
                { irrelevantField: 'someValue' },
                { cidrAddress: 'someCidr', '_odata_type@mv': '#microsoft.graph.ipRange' },
              ],
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(1)
          expect(res[0].detailedMessage).toEqual(
            'The required fields: cidrAddress, _odata_type@mv in ipRanges at indices 0 are missing',
          )
        })

        it('when ipRanges field is an array and has all fields', async () => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.ipNamedLocation',
              ipRanges: [{ cidrAddress: 'someCidr', '_odata_type@mv': '#microsoft.graph.ipRange' }],
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(0)
        })
      })

      describe('when locationType is countryNamedLocation', () => {
        it('when countriesAndRegions field is missing', async () => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.countryNamedLocation',
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(1)
          expect(res[0].detailedMessage).toEqual('The required field countriesAndRegions is missing')
        })

        it('when countriesAndRegions field is present', async () => {
          const conditionalAccessPolicyNamedLocation = new InstanceElement(
            INSTANCE_NAME,
            conditionalAccessPolicyNamedLocationType,
            {
              displayName: 'someDisplayName',
              custom: 'someCustom',
              [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.countryNamedLocation',
              countriesAndRegions: ['someCountry'],
            },
          )
          const changes = [
            toChange({
              before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
              after: conditionalAccessPolicyNamedLocation.clone(),
            }),
          ]
          const res = await requiredFieldsValidator(changes)
          expect(res).toHaveLength(0)
        })
      })
    },
  )

  describe(AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, () => {
    const authenticationStrengthPolicyType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME),
    })

    it('should return change error when allowedCombinations field is missing on addition', async () => {
      const authenticationStrengthPolicy = new InstanceElement(
        'testAuthenticationStrengthPolicy',
        authenticationStrengthPolicyType,
        {
          someOtherField: 'someValue',
        },
      )
      const changes = [
        toChange({
          after: authenticationStrengthPolicy.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following fields allowedCombinations are missing and required on addition changes.',
      )
    })

    it('should not return change error when allowedCombinations field is missing on modification', async () => {
      const authenticationStrengthPolicy = new InstanceElement(
        'testAuthenticationStrengthPolicy',
        authenticationStrengthPolicyType,
        {
          someOtherField: 'someValue',
        },
      )
      const changes = [
        toChange({
          before: authenticationStrengthPolicy.clone(),
          after: authenticationStrengthPolicy.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })

    it('should not return change error when allowedCombinations field is present on addition', async () => {
      const authenticationStrengthPolicy = new InstanceElement(
        'testAuthenticationStrengthPolicy',
        authenticationStrengthPolicyType,
        {
          allowedCombinations: ['someValue'],
          someOtherField: 'someValue',
        },
      )
      const changes = [
        toChange({
          before: undefined,
          after: authenticationStrengthPolicy.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(DIRECTORY_ROLE_TYPE_NAME, () => {
    const directoryRoleType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, DIRECTORY_ROLE_TYPE_NAME),
    })

    it('should return change error when roleTemplateId field is missing on addition', async () => {
      const directoryRole = new InstanceElement('testDirectoryRole', directoryRoleType, {
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          after: directoryRole.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following fields roleTemplateId are missing and required on addition changes.',
      )
    })

    it('should not return change error when roleTemplateId field is missing on modification', async () => {
      const directoryRole = new InstanceElement('testDirectoryRole', directoryRoleType, {
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          before: directoryRole.clone(),
          after: directoryRole.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })

    it('should not return change error when roleTemplateId field is present on addition', async () => {
      const directoryRole = new InstanceElement('testDirectoryRole', directoryRoleType, {
        roleTemplateId: 'someValue',
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          before: undefined,
          after: directoryRole.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(ROLE_DEFINITION_TYPE_NAME, () => {
    const roleDefinitionType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, ROLE_DEFINITION_TYPE_NAME),
    })

    it('should return change error when displayName, rolePermissions, isBuiltIn fields are missing on addition', async () => {
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, {
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          after: roleDefinition.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following fields displayName, rolePermissions, isBuiltIn are missing and required on addition changes.',
      )
    })

    it('should not return change error when displayName, rolePermissions, isBuiltIn fields are missing on modification', async () => {
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, {
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          before: roleDefinition.clone(),
          after: roleDefinition.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })

    it('should not return change error when displayName, rolePermissions, isBuiltIn fields are present on addition', async () => {
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, {
        displayName: 'someValue',
        rolePermissions: ['someValue'],
        isBuiltIn: true,
        someOtherField: 'someValue',
      })
      const changes = [
        toChange({
          before: undefined,
          after: roleDefinition.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })
})
