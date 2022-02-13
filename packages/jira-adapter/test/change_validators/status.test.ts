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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { statusValidator } from '../../src/change_validators/status'
import { JIRA } from '../../src/constants'

describe('statusValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'Status') })
    instance = new InstanceElement('instance', type)
  })
  it('should return if status does not have a category', async () => {
    expect(await statusValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'statusCategory is required to deploy statuses',
        detailedMessage: 'The status jira.Status.instance.instance is missing statusCategory',
      },
    ])
  })

  it('should not return an error if there is status category', async () => {
    instance.value.statusCategory = '1'

    expect(await statusValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
