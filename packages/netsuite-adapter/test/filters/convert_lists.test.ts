/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement } from '@salto-io/adapter-api'
import { customTypes } from '../../src/types'
import { DATASET, ENTITY_CUSTOM_FIELD } from '../../src/constants'
import filterCreator from '../../src/filters/convert_lists'

describe('convert_lists filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(instanceName,
      customTypes[DATASET],
      {
        name: instanceName,
        dependencies: {
          dependency: 'singleValue',
        },
      })
  })

  it('should not modify field with non ListType', async () => {
    await filterCreator().onFetch([instance])
    expect(instance.value.name).toEqual(instanceName)
  })

  it('should modify single value to a singleton in case of ListType', async () => {
    await filterCreator().onFetch([instance])
    expect(instance.value.dependencies.dependency).toEqual(['singleValue'])
  })

  it('should sort list values if in fieldsToSort', async () => {
    instance.value.dependencies.dependency = ['b', 'a', 'c']
    await filterCreator().onFetch([instance])
    expect(instance.value.dependencies.dependency).toEqual(['a', 'b', 'c'])
  })

  it('should not sort list if in fieldsToSort', async () => {
    const roleAccessesValue = [
      {
        accesslevel: '1',
        role: 'ADMINISTRATOR',
        searchlevel: '1',
      },
      {
        accesslevel: '2',
        role: 'BOOKKEEPER',
        searchlevel: '2',
      },
    ]

    instance = new InstanceElement(instanceName,
      customTypes[ENTITY_CUSTOM_FIELD],
      {
        label: instanceName,
        roleaccesses: {
          roleaccess: roleAccessesValue,
        },
      })
    await filterCreator().onFetch([instance])
    expect(instance.value.roleaccesses.roleaccess).toEqual(roleAccessesValue)
  })
})
