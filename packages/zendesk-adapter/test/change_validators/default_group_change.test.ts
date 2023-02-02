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
  const notChangingDefaultGroup = createGroup('notChangingDefaultGroup', true)
  const notChangingNotDefaultGroup = createGroup('notChangingNotDefaultGroup', false)
  it('should not allow the user to make a change of the default group', async () => {
    const changes = [
      toChange({ after: newDefaultGroup }), // New group that is default
      toChange({ before: removedDefaultGroup }), // Removed group that is default
      toChange({ before: beforeDefaultGroup, after: afterNotDefaultGroup }), // Changed from default to not default
      toChange({ before: beforeNotDefaultGroup, after: afterDefaultGroup }), // Changed from not default to default
      toChange({ before: notChangingDefaultGroup, after: notChangingDefaultGroup }), // No Change
      toChange({ before: notChangingNotDefaultGroup, after: notChangingNotDefaultGroup }), // No Change
    ]

    const errors = await defaultGroupChangeValidator(changes)
    expect(errors).toHaveLength(4)
    expect(errors).toEqual([
      {
        elemID: newDefaultGroup.elemID,
        severity: 'Warning',
        message: 'Cannot make changes of the default group',
        detailedMessage: 'TODO - talk with Tomer',
      },
      {
        elemID: removedDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot make changes of the default group',
        detailedMessage: 'TODO - talk with Tomer',
      },
      {
        elemID: afterNotDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot make changes of the default group',
        detailedMessage: 'TODO - talk with Tomer',
      },
      {
        elemID: afterDefaultGroup.elemID,
        severity: 'Error',
        message: 'Cannot make changes of the default group',
        detailedMessage: 'TODO - talk with Tomer',
      },
    ])
  })
})
