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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'
import { lockedFieldsValidator } from '../../src/change_validators/locked_fields'
import { JIRA } from '../../src/constants'

describe('lockedFieldsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
    instance = new InstanceElement('instance', type)
  })
  it('should return an error if a field is locked', async () => {
    instance.value.isLocked = true
    expect(await lockedFieldsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deploy a locked field',
        detailedMessage: 'The field is locked and cannot be deployed. Learn more here: https://help.salto.io/en/articles/6933969-the-field-is-locked-and-cannot-be-deployed',
      },
    ])
  })

  it('should not return an error if field is not locked', async () => {
    expect(await lockedFieldsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
