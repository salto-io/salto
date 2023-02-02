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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { GROUP_TYPE_NAME, ZENDESK } from '../../src/constants'
import { defaultGroupChangeValidator } from '../../src/change_validators'

const createGroup = (elemName: string, isDefault: boolean): InstanceElement => new InstanceElement(
  elemName,
  new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) }),
  { default: isDefault }
)

describe('defaultGroupDeletion', () => {
  const newDefaultGroup = createGroup('newDefaultGroup', true)
  const removedDefaultGroup = createGroup('removedDefaultGroup', true)
  const beforeDefaultGroup = createGroup('beforeDefaultGroup', true)
  const afterNotDefaultGroup = createGroup('afterDefaultGroup', false)
  const beforeNotDefaultGroup = createGroup('beforeNotDefaultGroup', false)
  const afterDefaultGroup = createGroup('afterDefaultGroup', true)
  const defaultGroup = createGroup('notChangingDefaultGroup', true)
  const notDefaultGroup = createGroup('notChangingNotDefaultGroup', false)
  it('should not allow the user to make a change of the default group', async () => {
    const changes = [
      toChange({ after: newDefaultGroup }), // New group that is default
      toChange({ before: removedDefaultGroup }), // Removed group that is default
      toChange({ before: beforeDefaultGroup, after: afterNotDefaultGroup }), // Changed from default to not default
      toChange({ before: beforeNotDefaultGroup, after: afterDefaultGroup }), // Changed from not default to default
      toChange({ before: defaultGroup, after: defaultGroup }), // No Change
      toChange({ before: notDefaultGroup, after: notDefaultGroup }), // No Change
      toChange({ before: notDefaultGroup }), // Should do nothing because it is not a default group
      toChange({ after: notDefaultGroup }), // Should do nothing because it is not a default group
    ]

    const errors = await defaultGroupChangeValidator(changes)
    expect(errors).toHaveLength(4)
    expect(errors).toEqual([
      {
        elemID: newDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot add a new default group',
        detailedMessage: 'Changing the default group is not supported via the Zendesk API, once deployed, you will need to set the group as default directly via Zendesk and fetch',
      },
      {
        elemID: removedDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot delete the default group',
        detailedMessage: `This group (${removedDefaultGroup.elemID.name}) is currently set as default in Zendesk and therefore cannot be deleted.\n`
            + 'Changing the default group is not supported via the Zendesk API, therefore, you will need to configure a new default group directly via Zendesk and fetch.',
      },
      {
        elemID: afterNotDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot change the default group',
        detailedMessage: 'Changing the default group is not supported via the Zendesk API, therefore, you will need to do it directly via Zendesk and fetch.',
      },
      {
        elemID: afterDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot change the default group',
        detailedMessage: 'Changing the default group is not supported via the Zendesk API, therefore, you will need to do it directly via Zendesk and fetch.',
      },
    ])
  })
})
