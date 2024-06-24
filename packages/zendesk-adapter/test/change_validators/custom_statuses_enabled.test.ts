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
import { Change, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  ACCOUNT_FEATURES_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { customStatusesEnabledValidator } from '../../src/change_validators'

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn((...args) => mockLogError(...args)),
  }),
}))

const createElementSource = ({ customStatusesEnabled }: { customStatusesEnabled: boolean }): ReadOnlyElementsSource => {
  const accountFeaturesType = new ObjectType({
    elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME),
  })
  const accountFeaturesInstance = new InstanceElement(ElemID.CONFIG_NAME, accountFeaturesType, {
    custom_statuses_enabled: {
      enabled: customStatusesEnabled,
    },
  })
  return buildElementsSourceFromElements([accountFeaturesInstance])
}

describe(customStatusesEnabledValidator.name, () => {
  const changeObjectType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const ticketFormObjectType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
  let customStatusInstance: InstanceElement
  let customStatusChange: Change<InstanceElement>

  beforeEach(() => {
    customStatusInstance = new InstanceElement('test', changeObjectType)
    customStatusChange = toChange({ after: customStatusInstance })
  })

  it('should not return an error when elementSource is undefined', async () => {
    const errors = await customStatusesEnabledValidator([customStatusChange])
    expect(errors).toHaveLength(0)
  })

  it('logs an error when elementSource is undefined', async () => {
    await customStatusesEnabledValidator([customStatusChange])
    expect(mockLogError).toHaveBeenCalledWith(
      'Failed to run customStatusesEnabledValidator because no element source was provided',
    )
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
          elemID: customStatusInstance.elemID,
          severity: 'Error',
          message: 'Custom statuses are not enabled.',
          detailedMessage: 'Cannot deploy custom statuses when they are not enabled in the Zendesk account.',
        })
      })
    })

    describe('when ticket form has agent condition with custom statuses', () => {
      it('returns a warning', async () => {
        const ticketFormInstance = new InstanceElement('test', ticketFormObjectType, {
          agent_conditions: [
            {
              parent_field_id: '123',
              child_fields: [
                {
                  id: '123',
                  required_on_statuses: {
                    type: 'testType',
                    custom_statuses: ['custom status 1'],
                  },
                },
              ],
            },
          ],
        })
        const ticketFormChange = toChange({ after: ticketFormInstance })

        const errors = await customStatusesEnabledValidator([ticketFormChange], elementSource)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toEqual({
          elemID: ticketFormInstance.elemID,
          severity: 'Warning',
          message: 'Deploying ticket form with custom statuses while custom statuses are disabled',
          detailedMessage:
            'It seems this ticket form originates from another account that has custom statuses enabled. ' +
            'Since custom statuses are disabled in the target account, ' +
            'this ticket form will be deployed without the custom_statuses fields',
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
