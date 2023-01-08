/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { defaultGroupDeletion } from '../../src/change_validators'

describe('defaultGroupDeletion', () => {
  const defaultGroup = new InstanceElement(
    'defaultGroup',
    new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) }),
    { default: true }
  )
  const notDefaultGroup = new InstanceElement(
    'defaultGroup',
    new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) }),
    { default: false }
  )
  it('return error on deletion of the default group', async () => {
    const changes = [
      toChange({ before: defaultGroup }),
      toChange({ before: notDefaultGroup }),
    ]

    const errors = await defaultGroupDeletion(changes)
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatchObject({
      elemID: defaultGroup.elemID,
      severity: 'Error',
      message: 'Default group cannot be deleted',
      detailedMessage: `Group ${defaultGroup.elemID.name} is marked as default and therefore cannot be deleted`,
    })
  })
})
