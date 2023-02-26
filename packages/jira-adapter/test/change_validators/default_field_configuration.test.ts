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
import { defaultFieldConfigurationValidator } from '../../src/change_validators/default_field_configuration'
import { JIRA } from '../../src/constants'

describe('defaultFieldConfigurationValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'FieldConfiguration') })
    instance = new InstanceElement(
      'instance',
      type,
      {
        isDefault: true,
      }
    )
  })

  it('should return an error if changed', async () => {
    const afterInstance = instance.clone()
    afterInstance.value.name = 'new name'

    expect(await defaultFieldConfigurationValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Modifying the default field configuration is not supported',
        detailedMessage: 'Modifying the default field configuration is not supported.',
      },
    ])
  })

  it('should not return an error if not default', async () => {
    delete instance.value.isDefault
    const afterInstance = instance.clone()
    afterInstance.value.name = 'new name'

    expect(await defaultFieldConfigurationValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([])
  })
})
