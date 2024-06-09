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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  ADAPTER_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  ODATA_TYPE_FIELD_NACL_CASE,
} from '../../src/constants'
import { requiredFieldsValidator } from '../../src/change_validators'

describe(`${requiredFieldsValidator.name}`, () => {
  describe.each(['addition', 'modification'])(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, changeType => {
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
      const elementSource = buildElementsSourceFromElements([
        authenticationMethodConfigurationType,
        authenticationMethodConfiguration,
      ])
      const changes = [
        toChange({
          before: changeType === 'modification' ? authenticationMethodConfiguration.clone() : undefined,
          after: authenticationMethodConfiguration.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes, elementSource)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(`Instance is missing required fields _odata_type@mv on ${changeType}`)
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
      const elementSource = buildElementsSourceFromElements([
        authenticationMethodConfigurationType,
        authenticationMethodConfiguration,
      ])
      const changes = [
        toChange({
          before: changeType === 'modification' ? authenticationMethodConfiguration.clone() : undefined,
          after: authenticationMethodConfiguration.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes, elementSource)
      expect(res).toHaveLength(0)
    })
  })

  describe.each(['addition', 'modification'])(CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME, changeType => {
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
      const elementSource = buildElementsSourceFromElements([
        conditionalAccessPolicyNamedLocationType,
        conditionalAccessPolicyNamedLocation,
      ])
      const changes = [
        toChange({
          before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
          after: conditionalAccessPolicyNamedLocation.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes, elementSource)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual('Instance is missing required field displayName')
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
      const elementSource = buildElementsSourceFromElements([
        conditionalAccessPolicyNamedLocationType,
        conditionalAccessPolicyNamedLocation,
      ])
      const changes = [
        toChange({
          before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
          after: conditionalAccessPolicyNamedLocation.clone(),
        }),
      ]
      const res = await requiredFieldsValidator(changes, elementSource)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual('Instance is missing required field _odata_type@mv')
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual(
          'Instance is missing required field ipRanges or has a bad format. Expected Array of objects with fields cidrAddress, _odata_type@mv',
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual(
          'Instance is missing required field ipRanges or has a bad format. Expected Array of objects with fields cidrAddress, _odata_type@mv',
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual(
          'Instance is missing required fields cidrAddress, _odata_type@mv in ipRanges at indices 0',
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
        expect(res).toHaveLength(1)
        expect(res[0].detailedMessage).toEqual('Instance is missing required field countriesAndRegions')
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
        const elementSource = buildElementsSourceFromElements([
          conditionalAccessPolicyNamedLocationType,
          conditionalAccessPolicyNamedLocation,
        ])
        const changes = [
          toChange({
            before: changeType === 'modification' ? conditionalAccessPolicyNamedLocation.clone() : undefined,
            after: conditionalAccessPolicyNamedLocation.clone(),
          }),
        ]
        const res = await requiredFieldsValidator(changes, elementSource)
        expect(res).toHaveLength(0)
      })
    })
  })
})
