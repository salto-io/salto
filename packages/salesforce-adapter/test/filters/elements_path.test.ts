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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import {
  INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, PROFILE_METADATA_TYPE, RECORDS_PATH, SALESFORCE,
} from '../../src/constants'
import filterCreator from '../../src/filters/elements_path'
import { FilterWith } from '../../src/filter'

describe('elements path filter', () => {
  const filter = filterCreator() as FilterWith<'onFetch'>
  const origInstance = new InstanceElement(
    'test',
    new ObjectType({ elemID: new ElemID(SALESFORCE, 'instanceType') }),
    undefined,
    [SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'test']
  )

  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should replace instance path', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    await filter.onFetch([instance])
    expect(instance.path)
      .toEqual([SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'System_Administrator'])
  })

  it('should not replace instance path if its metadataType is not in the mapping', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.type.annotations[METADATA_TYPE] = 'some other metadataType'
    await filter.onFetch([instance])
    expect(instance.path).toEqual(origInstance.path)
  })

  it('should not replace instance path if its apiName is not in the mapping', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'some other apiName'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    await filter.onFetch([instance])
    expect(instance.path).toEqual(origInstance.path)
  })

  it('should not replace instance path if it has no path', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    instance.path = undefined
    await filter.onFetch([instance])
    expect(instance.path).toBeUndefined()
  })
})
