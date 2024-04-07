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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { dynamicOSVersionFeatureValidator } from '../../src/change_validators/dynamic_os_version_feature'
import { OKTA, FEATURE_TYPE_NAME, DEVICE_ASSURANCE } from '../../src/constants'

describe('dynamicOSVersionFeatureValidator', () => {
  const message = 'Dynamic OS version compliance feature is not enabled in the account'
  const detailedMessage =
    'This Device Assurance policy is using dynamic OS version constraints which requires the Dynamic OS version compliance feature to be enabled in the account. To fix this error, enable this feature in your account, fetch your updated configuration through Salto and refresh this deployment.'
  const deviceAssuranceType = new ObjectType({ elemID: new ElemID(OKTA, DEVICE_ASSURANCE) })
  const featureType = new ObjectType({ elemID: new ElemID(OKTA, FEATURE_TYPE_NAME) })
  const dynamicOSVersionFeature = new InstanceElement('a', featureType, {
    type: 'self-service',
    name: 'Dynamic OS version compliance',
    status: 'DISABLED',
  })
  const randomFeature = new InstanceElement('b', featureType, {
    type: 'self-service',
    name: 'Random feature',
    status: 'ENABLED',
  })
  const windowsAssuranceA = new InstanceElement('devicePolicy', deviceAssuranceType, {
    platform: 'WINDOWS',
    name: 'policiy',
    osVersionConstraints: [{ majorVersionConstraint: 'WINDOWS_11', minimum: '10.0.22631.0' }],
  })
  const windowsAssuranceB = new InstanceElement('devicePolicyB', deviceAssuranceType, {
    platform: 'WINDOWS',
    name: 'policiy',
    additionalProperties: {
      osVersionConstraints: [{ majorVersionConstraint: 'WINDOWS_11', minimum: '10.0.22631.0' }],
    },
  })
  const macOSAssuranceA = new InstanceElement('macOS', deviceAssuranceType, {
    platform: 'MACOS',
    name: 'mac policy',
    osVersion: { dynamicVersionRequirement: { type: 'MINIMUM', distanceFromLatestMajor: 1 } },
  })
  const macOSAssuranceB = new InstanceElement('macOSB', deviceAssuranceType, {
    platform: 'MACOS',
    name: 'mac policy',
    osVersion: { additionalProperties: { dynamicVersionRequirement: { type: 'MINIMUM', distanceFromLatestMajor: 1 } } },
  })

  it('should return an error when attempting to deploy device assurance policy with dynamic os constraints and the feature is disabled', async () => {
    const elementSource = buildElementsSourceFromElements([
      deviceAssuranceType,
      featureType,
      dynamicOSVersionFeature,
      randomFeature,
      windowsAssuranceA,
      windowsAssuranceB,
      macOSAssuranceA,
      macOSAssuranceB,
    ])
    const changeErrors = await dynamicOSVersionFeatureValidator(
      [
        toChange({ after: windowsAssuranceA }),
        toChange({ after: windowsAssuranceB }),
        toChange({ before: macOSAssuranceA, after: macOSAssuranceA }),
        toChange({ after: macOSAssuranceB }),
      ],
      elementSource,
    )
    expect(changeErrors).toHaveLength(4)
    expect(changeErrors).toEqual([
      { elemID: windowsAssuranceA.elemID, severity: 'Error', message, detailedMessage },
      { elemID: windowsAssuranceB.elemID, severity: 'Error', message, detailedMessage },
      { elemID: macOSAssuranceA.elemID, severity: 'Error', message, detailedMessage },
      { elemID: macOSAssuranceB.elemID, severity: 'Error', message, detailedMessage },
    ])
  })
  it('should not return an error when attempting to deploy device assurance policy with dynamic os constraints and the feature is enabled', async () => {
    const enabledFeature = dynamicOSVersionFeature.clone()
    enabledFeature.value.status = 'ENABLED'
    const elementSource = buildElementsSourceFromElements([
      deviceAssuranceType,
      featureType,
      enabledFeature,
      randomFeature,
      windowsAssuranceA,
      macOSAssuranceA,
    ])
    const changeErrors = await dynamicOSVersionFeatureValidator(
      [toChange({ after: windowsAssuranceA }), toChange({ before: macOSAssuranceA, after: macOSAssuranceA })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return an error when adding a device assurance policy with no dynamic os constraints and the feature is disabled', async () => {
    const assuranceInsB = new InstanceElement('devicePolicy', deviceAssuranceType, {
      platform: 'WINDOWS',
      name: 'policiy',
      osVersion: { minimum: '10.0.22631.0' },
    })
    const elementSource = buildElementsSourceFromElements([
      deviceAssuranceType,
      featureType,
      dynamicOSVersionFeature,
      randomFeature,
      assuranceInsB,
    ])
    const changeErrors = await dynamicOSVersionFeatureValidator([toChange({ after: assuranceInsB })], elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return an error when the feature is missing', async () => {
    const elementSource = buildElementsSourceFromElements([
      deviceAssuranceType,
      featureType,
      randomFeature,
      windowsAssuranceA,
      macOSAssuranceA,
    ])
    const changeErrors = await dynamicOSVersionFeatureValidator(
      [toChange({ after: windowsAssuranceA }), toChange({ before: macOSAssuranceA, after: macOSAssuranceA })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
})
