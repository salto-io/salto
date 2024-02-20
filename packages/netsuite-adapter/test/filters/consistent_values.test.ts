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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/consistent_values'
import { METADATA_TYPE, NETSUITE, PERMITTED_ROLE, RECORD_TYPE } from '../../src/constants'
import { transactionFormType } from '../../src/autogen/types/standard_types/transactionForm'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { entryFormType } from '../../src/autogen/types/standard_types/entryForm'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { LocalFilterOpts } from '../../src/filter'

describe('consistent_values filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  let customRecordType: ObjectType
  beforeEach(() => {
    instance = new InstanceElement(instanceName, transactionFormType().type, {
      name: instanceName,
      [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
    })
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotationRefsOrTypes: {
        permissions: customrecordtypeType().innerTypes.customrecordtype_permissions,
      },
      annotations: {
        [METADATA_TYPE]: 'customrecordtype',
        permissions: {
          permission: [
            {
              [PERMITTED_ROLE]: 'CUSTOMROLEAP_CLERK',
            },
          ],
        },
      },
    })
  })

  it('should modify field with inconsistent value', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance, customRecordType])
    expect(instance.value.name).toEqual(instanceName)
    expect(instance.value[RECORD_TYPE]).toEqual('JOURNALENTRY')
  })

  it('should modify custom record type annotations with inconsistent value', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance, customRecordType])
    expect(customRecordType.annotations.permissions.permission[0][PERMITTED_ROLE]).toEqual('AP_CLERK')
  })

  it('should not modify field with consistent value', async () => {
    instance.value[RECORD_TYPE] = 'some consistent value'
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance, customRecordType])
    expect(instance.value.name).toEqual(instanceName)
    expect(instance.value[RECORD_TYPE]).toEqual('some consistent value')
  })

  it('should not modify field for instances with other types that have inconsistent values', async () => {
    const entryFormInstance = new InstanceElement(instanceName, entryFormType().type, {
      name: instanceName,
      [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([entryFormInstance])
    expect(entryFormInstance.value.name).toEqual(instanceName)
    expect(entryFormInstance.value[RECORD_TYPE]).toEqual('INTERCOMPANYJOURNALENTRY')
  })

  it('should not modify field for instances that have no field mappings', async () => {
    const instanceWithNoMappings = new InstanceElement(instanceName, entitycustomfieldType().type, {
      name: instanceName,
      [RECORD_TYPE]: 'INTERCOMPANYJOURNALENTRY',
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([instanceWithNoMappings])
    expect(instanceWithNoMappings.value.name).toEqual(instanceName)
    expect(instanceWithNoMappings.value[RECORD_TYPE]).toEqual('INTERCOMPANYJOURNALENTRY')
  })
})
