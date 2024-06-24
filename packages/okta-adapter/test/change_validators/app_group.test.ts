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
import { appGroupValidator } from '../../src/change_validators/app_group'
import { OKTA, GROUP_TYPE_NAME } from '../../src/constants'

describe('appGroupValidator', () => {
  const type = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const appGroup = new InstanceElement('group', type, {
    label: 'group1',
    profile: { name: 'group' },
    type: 'APP_GROUP',
  })
  const appGroup2 = new InstanceElement('group2', type, {
    label: 'group2',
    profile: { name: 'group2' },
    type: 'APP_GROUP',
  })
  const oktaGroup = new InstanceElement('oktaGroup', type, {
    label: 'group1',
    profile: { name: 'group' },
    type: 'OKTA_GROUP',
  })
  it('should return an error if when APP_GROUP is added or changed', async () => {
    const changeErrors = await appGroupValidator([
      toChange({ before: appGroup, after: appGroup }),
      toChange({ after: appGroup2 }),
    ])
    expect(changeErrors).toEqual([
      {
        elemID: appGroup.elemID,
        severity: 'Error',
        message: 'Cannot add or modify group of type APP_GROUP',
        detailedMessage:
          'Groups of type APP_GROUP cannot be updated through Okta API. Application import operations are responsible for syncing Groups of type APP_GROUP.',
      },
      {
        elemID: appGroup2.elemID,
        severity: 'Error',
        message: 'Cannot add or modify group of type APP_GROUP',
        detailedMessage:
          'Groups of type APP_GROUP cannot be updated through Okta API. Application import operations are responsible for syncing Groups of type APP_GROUP.',
      },
    ])
  })
  it('should not return error for changes in okta groups or removals of APP_GROUP', async () => {
    const changeErrors = await appGroupValidator([toChange({ after: oktaGroup }), toChange({ before: appGroup })])
    expect(changeErrors).toEqual([])
  })
})
