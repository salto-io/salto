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
import { Change, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ACCOUNT_FEATURES_TYPE_NAME, CUSTOM_STATUS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { customStatusesEnabledValidator } from '../../src/change_validators'

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn()
    .mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn((...args) => mockLogError(...args)),
    }),
}))

const createElementSource = ({ customStatusesEnabled }: { customStatusesEnabled: boolean }): ReadOnlyElementsSource => {
  const accountFeaturesType = new ObjectType({
    elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME),
  })
  const accountFeaturesInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    accountFeaturesType,
    {
      custom_statuses_enabled: {
        enabled: customStatusesEnabled,
      },
    },
  )
  return buildElementsSourceFromElements([accountFeaturesInstance])
}

describe(customStatusesEnabledValidator.name, () => {
  let changeObjectType: ObjectType
  let instance: InstanceElement
  let customStatusChange: Change<InstanceElement>

  beforeEach(() => {
    changeObjectType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
    instance = new InstanceElement('test', changeObjectType)
    customStatusChange = toChange({ after: instance })
  })

  it('should not return an error when elementSource is undefined', async () => {
    const errors = await customStatusesEnabledValidator([customStatusChange])
    expect(errors).toHaveLength(0)
  })

  it('logs an error when elementSource is undefined', async () => {
    await customStatusesEnabledValidator([customStatusChange])
    expect(mockLogError).toHaveBeenCalledWith('Failed to run customStatusesEnabledValidator because no element source was provided')
  })

  it('should not return an error when account features is missing', async () => {
    const errors = await customStatusesEnabledValidator([customStatusChange], buildElementsSourceFromElements([]))
    expect(errors).toHaveLength(0)
  })

  describe('when the custom statuses feature is enabled', () => {
    const elementSource = createElementSource({ customStatusesEnabled: true })
    it('should return no errors', async () => {
      const errors = await customStatusesEnabledValidator([customStatusChange], elementSource)
      expect(errors).toHaveLength(0)
    })
  })

  describe('when the custom statuses feature is disabled', () => {
    const elementSource = createElementSource({ customStatusesEnabled: false })

    describe('with custom status changes', () => {
      it('returns an error', async () => {
        const errors = await customStatusesEnabledValidator([customStatusChange], elementSource)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toEqual({
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Custom statuses are not enabled.',
          detailedMessage: 'Cannot deploy custom statuses when they are not enabled in the Zendesk account.',
        })
      })
    })

    describe('without custom status changes', () => {
      it('should not return an error', async () => {
        const errors = await customStatusesEnabledValidator([], elementSource)
        expect(errors).toHaveLength(0)
      })
    })
  })
})
