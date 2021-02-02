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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import {
  INSTANCE_FULL_NAME_FIELD, INTERNAL_ID_FIELD, METADATA_TYPE, PROFILE_METADATA_TYPE, RECORDS_PATH,
  SALESFORCE,
} from '../../src/constants'
import filterCreator from '../../src/filters/profile_paths'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { mockQueryResult } from '../connection'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('profile paths filter', () => {
  const { client, connection } = mockClient()
  const filter = filterCreator({ client, config: { fetchProfile: buildFetchProfile({}) } }) as FilterWith<'onFetch'>
  const origInstance = new InstanceElement(
    'test',
    new ObjectType({ elemID: new ElemID(SALESFORCE, 'instanceType') }),
    undefined,
    [SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'test']
  )

  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
    connection.query.mockResolvedValue(mockQueryResult({
      records: [
        { Id: 'PlatformPortalInternalId', Name: 'Authenticated Website' },
        { Id: 'AdminInternalId', Name: 'System Administrator' },
      ],
      totalSize: 2,
    }))
  })

  it('should replace profile instance path', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    await filter.onFetch([instance])
    expect(instance.path)
      .toEqual([SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'System_Administrator'])
  })

  it('should replace instance path for PlatformPortal Profile', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'PlatformPortal'
    instance.value[INTERNAL_ID_FIELD] = 'PlatformPortalInternalId'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    await filter.onFetch([instance])
    expect(instance.path)
      .toEqual([SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'Authenticated_Website2'])
  })

  it('should not replace instance path for other metadataTypes', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    instance.type.annotations[METADATA_TYPE] = 'some other metadataType'
    await filter.onFetch([instance])
    expect(instance.path).toEqual(origInstance.path)
  })

  it('should not replace instance path if it has no path', async () => {
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    instance.type.annotations[METADATA_TYPE] = PROFILE_METADATA_TYPE
    instance.path = undefined
    await filter.onFetch([instance])
    expect(instance.path).toBeUndefined()
  })
})
