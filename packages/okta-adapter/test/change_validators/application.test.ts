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
import { applicationValidator } from '../../src/change_validators/application'
import { OKTA, APPLICATION_TYPE_NAME } from '../../src/constants'

describe('applicationChangeValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
    instance = new InstanceElement('bookmarkApp', type, {
      label: 'bookmark app',
      status: 'ACTIVE',
      signOnMode: 'BOOKMARK',
    })
  })
  it('should return an error if an active application is removed', async () => {
    instance.value.status = 'ACTIVE'
    expect(
      await applicationValidator([
        toChange({
          before: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot remove an active application',
        detailedMessage: `Cannot remove an active application: ${instance.elemID.getFullName()} must be deactivated before removal`,
      },
    ])
  })
})
