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
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'
import { systemFieldsValidator } from '../../src/change_validators/system_fields'
import { JIRA } from '../../src/constants'

describe('systemFieldsValidator', () => {
  const type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
  it('should return an error if a field is a system field', async () => {
    const systemFieldInstance = new InstanceElement('instance', type)
    systemFieldInstance.value.schema = {}
    expect(await systemFieldsValidator([
      toChange({
        after: systemFieldInstance,
      }),
    ])).toEqual([
      {
        elemID: systemFieldInstance.elemID,
        severity: 'Error',
        message: 'Cannot deploy a system field',
        detailedMessage: 'The field jira.Field.instance.instance is a system field and cannot be deployed',
      },
    ])
  })

  it('should not return an error if the field is not a system field', async () => {
    const notSystemFieldInstance = new InstanceElement('instance', type)
    expect(await systemFieldsValidator([
      toChange({
        after: notSystemFieldInstance,
      }),
    ])).toEqual([])
  })
})
