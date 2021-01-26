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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/consistent_values'
import { customTypes } from '../../src/types'
import { ENTITY_CUSTOM_FIELD, ENTRY_FORM, TRANSACTION_FORM, RECORD_TYPE } from '../../src/constants'
import { OnFetchParameters } from '../../src/filter'

describe('consistent_values filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  let onFetchParameters: OnFetchParameters
  beforeEach(() => {
    instance = new InstanceElement(instanceName,
      customTypes[TRANSACTION_FORM],
      {
        name: instanceName,
        [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
      })

    onFetchParameters = {
      elements: [instance],
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })


  it('should modify field with inconsistent value', async () => {
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.name).toEqual(instanceName)
    expect(instance.value[RECORD_TYPE]).toEqual('JOURNALENTRY')
  })

  it('should not modify field with consistent value', async () => {
    instance.value[RECORD_TYPE] = 'some consistent value'
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.value.name).toEqual(instanceName)
    expect(instance.value[RECORD_TYPE]).toEqual('some consistent value')
  })

  it('should not modify field for instances with other types that have inconsistent values', async () => {
    const entryFormInstance = new InstanceElement(instanceName,
      customTypes[ENTRY_FORM],
      {
        name: instanceName,
        [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
      })
    await filterCreator().onFetch({
      ...onFetchParameters,
      elements: [entryFormInstance],
    })
    expect(entryFormInstance.value.name).toEqual(instanceName)
    expect(entryFormInstance.value[RECORD_TYPE]).toEqual('INTERCOMPANYJOURNALENTRY')
  })

  it('should not modify field for instances that have no field mappings', async () => {
    const instanceWithNoMappings = new InstanceElement(instanceName,
      customTypes[ENTITY_CUSTOM_FIELD],
      {
        name: instanceName,
        [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
      })
    await filterCreator().onFetch({
      ...onFetchParameters,
      elements: [instanceWithNoMappings],
    })
    expect(instanceWithNoMappings.value.name).toEqual(instanceName)
    expect(instanceWithNoMappings.value[RECORD_TYPE]).toEqual('INTERCOMPANYJOURNALENTRY')
  })
})
