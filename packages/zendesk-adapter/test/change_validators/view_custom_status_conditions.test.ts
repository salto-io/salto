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
import _ from 'lodash'
import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { elementSource, RemoteElementSource } from '@salto-io/workspace'
import { VIEW_TYPE_NAME, ZENDESK } from '../../src/constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../../src/filters/account_settings'
import { viewCustomStatusConditionsValidator } from '../../src/change_validators'

const { createInMemoryElementSource } = elementSource

const createElementSource = (customStatusesEnabled: boolean): RemoteElementSource => {
  const accountSetting = new InstanceElement(
    '_config',
    new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME) }),
    {
      active_features: {},
      tickets: {
        custom_statuses_enabled: customStatusesEnabled,
      },
    },
  )
  return createInMemoryElementSource([accountSetting])
}

const createConditions = (customConditions: number, standardConditions: number): {}[] =>
  _.concat(
    _.range(customConditions).map(i => ({
      field: 'custom_status_id',
      operator: 'includes',
      value: `custom_status_${i}`,
    })),
    _.range(standardConditions).map(i => ({
      field: 'status',
      operator: 'is',
      value: `status_${i}`,
    })),
  )

const createInstance = (
  allCustomConditions: number,
  allStandardConditions: number,
  anyCustomConditions: number,
  anyStandardConditions: number,
): InstanceElement =>
  new InstanceElement(
    `view_${allCustomConditions}_${allStandardConditions}_${anyCustomConditions}_${anyStandardConditions}`,
    new ObjectType({ elemID: new ElemID(ZENDESK, VIEW_TYPE_NAME) }),
    {
      conditions: {
        all: createConditions(allCustomConditions, allStandardConditions),
        any: createConditions(anyCustomConditions, anyStandardConditions),
      },
    },
  )

const toChanges = (views: InstanceElement[]): Change[] => views.map(view => toChange({ after: view }))

describe('viewCustomStatusConditionsValidator', () => {
  it('should return nothing when custom statuses are enabled', async () => {
    const tempElementSource = createElementSource(true)
    const changes = toChanges([createInstance(0, 0, 0, 0), createInstance(1, 0, 1, 0), createInstance(3, 3, 3, 3)])

    const errors = await viewCustomStatusConditionsValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })

  it('should return nothing when no custom status conditions are defined', async () => {
    const tempElementSource = createElementSource(false)
    const changes = toChanges([createInstance(0, 0, 0, 0), createInstance(0, 1, 0, 2)])

    const errors = await viewCustomStatusConditionsValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })

  it('should return errors when custom statuses are disabled but used in conditions', async () => {
    const tempElementSource = createElementSource(false)
    const validViews = [createInstance(0, 0, 0, 0), createInstance(0, 1, 0, 2)]
    const invalidViews = [createInstance(1, 0, 1, 0), createInstance(3, 3, 3, 3)]
    const changes = toChanges(validViews.concat(invalidViews))

    const errors = await viewCustomStatusConditionsValidator(changes, tempElementSource)
    expect(errors).toMatchObject(
      invalidViews.map(view => ({
        elemID: view.elemID,
        severity: 'Error',
        message: "View includes a condition on field 'custom_status_id' but custom ticket statuses are disabled",
        detailedMessage:
          "View includes a condition on field 'custom_status_id' but custom ticket statuses are disabled. To apply conditions on custom ticket statuses, please activate this feature first. For help see: https://support.zendesk.com/hc/en-us/articles/4412575841306-Activating-custom-ticket-statuses.",
      })),
    )
  })

  it('should return nothing when there are no account settings', async () => {
    const tempElementSource = createInMemoryElementSource()
    const changes = toChanges([createInstance(0, 0, 0, 0), createInstance(1, 0, 1, 0), createInstance(3, 3, 3, 3)])

    const errors = await viewCustomStatusConditionsValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })
})
