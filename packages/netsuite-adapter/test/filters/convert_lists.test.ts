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
import { InstanceElement } from '@salto-io/adapter-api'
import { customTypes } from '../../src/types'
import { DATASET, ENTITY_CUSTOM_FIELD, SAVED_CSV_IMPORT } from '../../src/constants'
import filterCreator from '../../src/filters/convert_lists'
import { OnFetchParameters } from '../../src/filter'
import NetsuiteClient from '../../src/client/client'

describe('convert_lists filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  let onFetchParameters: OnFetchParameters
  beforeEach(() => {
    instance = new InstanceElement(instanceName,
      customTypes[DATASET],
      {
        name: instanceName,
        dependencies: {
          dependency: 'singleValue',
        },
      })
    onFetchParameters = {
      elements: [instance],
      client: {} as NetsuiteClient,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve({ serviceIdsIndex: {}, internalIdsIndex: {} }),
      },
      isPartial: false,
    }
  })


  it('should not modify field with non ListType', async () => {
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.name).toEqual(instanceName)
  })

  it('should modify single value to a singleton in case of ListType', async () => {
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.dependencies.dependency).toEqual(['singleValue'])
  })

  it('should sort primitive list values if in unorderedListFields', async () => {
    instance.value.dependencies.dependency = ['b', 'a', 'c']
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.dependencies.dependency).toEqual(['a', 'b', 'c'])
  })

  it('should sort object list values if in unorderedListFields', async () => {
    const savedCsvImportInstance = new InstanceElement('instance',
      customTypes[SAVED_CSV_IMPORT],
      {
        filemappings: {
          filemapping: [
            {
              file: 'VENDORBILL:EXPENSE',
              foreignkey: 'External ID',
            },
            {
              file: 'VENDORBILL',
              primarykey: 'External ID',
            },
          ],
        },
      })
    onFetchParameters.elements = [savedCsvImportInstance]
    await filterCreator().onFetch(onFetchParameters)
    expect(savedCsvImportInstance.value.filemappings.filemapping).toEqual([
      {
        file: 'VENDORBILL',
        primarykey: 'External ID',
      },
      {
        file: 'VENDORBILL:EXPENSE',
        foreignkey: 'External ID',
      },
    ])
  })

  it('should not sort list if in unorderedListFields', async () => {
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
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.roleaccesses.roleaccess).toEqual(roleAccessesValue)
  })
})
