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
import filterCreator from '../../src/filters/consistent_values'
import { customTypes } from '../../src/types'
import {
  CUSTOM_RECORD_TYPE, ENTITY_CUSTOM_FIELD, ENTRY_FORM, TRANSACTION_FORM, PERMITTED_ROLE,
  RECORD_TYPE,
} from '../../src/constants'

describe('consistent_values filter', () => {
  const instanceName = 'instanceName'
  const instanceWithNestedInconsistentValueName = 'instanceWithNestedInconsistentValue'
  let instance: InstanceElement
  let instanceWithNestedInconsistentValue: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(instanceName,
      customTypes[TRANSACTION_FORM],
      {
        name: instanceName,
        [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
      })
    instanceWithNestedInconsistentValue = new InstanceElement(
      instanceWithNestedInconsistentValueName,
      customTypes[CUSTOM_RECORD_TYPE],
      {
        name: instanceWithNestedInconsistentValueName,
        permissions: {
          permission: [{
            [PERMITTED_ROLE]: 'CUSTOMROLEAP_CLERK',
          }],
        },
      }
    )
  })

  it('should modify field with inconsistent value', async () => {
    await filterCreator().onFetch([instance, instanceWithNestedInconsistentValue])
    expect(instance.value.name).toEqual(instanceName)
    expect(instance.value[RECORD_TYPE]).toEqual('JOURNALENTRY')
  })

  it('should modify nested field with inconsistent value', async () => {
    await filterCreator().onFetch([instance, instanceWithNestedInconsistentValue])
    expect(instanceWithNestedInconsistentValue.value.name)
      .toEqual(instanceWithNestedInconsistentValueName)
    expect(instanceWithNestedInconsistentValue.value.permissions.permission[0][PERMITTED_ROLE])
      .toEqual('AP_CLERK')
  })

  it('should not modify field with consistent value', async () => {
    instance.value[RECORD_TYPE] = 'some consistent value'
    await filterCreator().onFetch([instance, instanceWithNestedInconsistentValue])
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
    await filterCreator().onFetch([entryFormInstance])
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
    await filterCreator().onFetch([instanceWithNoMappings])
    expect(instanceWithNoMappings.value.name).toEqual(instanceName)
    expect(instanceWithNoMappings.value[RECORD_TYPE]).toEqual('INTERCOMPANYJOURNALENTRY')
  })
})
