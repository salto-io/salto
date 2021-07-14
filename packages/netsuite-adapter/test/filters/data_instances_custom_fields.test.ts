/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_custom_fields'
import { NETSUITE } from '../../src/constants'

describe('data_instances_custom_fields', () => {
  let instance: InstanceElement

  beforeEach(() => {
    instance = new InstanceElement(
      'name',
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'Customer'),
        fields: { someId: { refType: BuiltinTypes.NUMBER } },
        annotations: { source: 'soap' },
      }),
      {
        customFieldList: {
          customField: [{
            value: '123',
            scriptId: 'someId',
          }],
        },
      }
    )
  })
  it('should add an integer field', async () => {
    await filterCreator().onFetch([instance])
    expect(instance.value.customFieldList).toBeUndefined()
    expect(instance.value.someId).toBe(123)
  })

  it('should do nothing if there are no custom fields values', async () => {
    delete instance.value.customFieldList
    await filterCreator().onFetch([instance])
    expect(instance.value).toEqual({})
  })
})
