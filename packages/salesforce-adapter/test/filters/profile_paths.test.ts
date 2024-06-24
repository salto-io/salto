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
import {
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_FIELD,
  METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORDS_PATH,
  SALESFORCE,
} from '../../src/constants'
import filterCreator, { WARNING_MESSAGE } from '../../src/filters/profile_paths'
import { FilterResult } from '../../src/filter'
import mockClient from '../client'
import { mockQueryResult } from '../connection'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { FilterWith } from './mocks'

describe('profile paths filter', () => {
  const { connection, client } = mockClient()
  let filter = filterCreator({
    client,
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const origInstance = new InstanceElement(
    'test',
    new ObjectType({ elemID: new ElemID(SALESFORCE, 'instanceType') }),
    undefined,
    [SALESFORCE, RECORDS_PATH, PROFILE_METADATA_TYPE, 'test'],
  )

  let instance: InstanceElement
  beforeEach(() => {
    jest.clearAllMocks()
    instance = origInstance.clone()
    connection.query.mockResolvedValue(
      mockQueryResult({
        records: [
          { Id: 'PlatformPortalInternalId', Name: 'Authenticated Website' },
          { Id: 'AdminInternalId', Name: 'System Administrator' },
        ],
        totalSize: 2,
      }),
    )
  })

  it('should not run query when we do not fetch profiles', async () => {
    await filter.onFetch([])
    expect(connection.query).not.toHaveBeenCalled()
  })

  it('should replace profile instance path', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      PROFILE_METADATA_TYPE
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    await filter.onFetch([instance])
    expect(instance.path).toEqual([
      SALESFORCE,
      RECORDS_PATH,
      PROFILE_METADATA_TYPE,
      'System_Administrator',
    ])
  })

  it('should replace instance path for PlatformPortal Profile', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      PROFILE_METADATA_TYPE
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'PlatformPortal'
    instance.value[INTERNAL_ID_FIELD] = 'PlatformPortalInternalId'
    await filter.onFetch([instance])
    expect(instance.path).toEqual([
      SALESFORCE,
      RECORDS_PATH,
      PROFILE_METADATA_TYPE,
      'Authenticated_Website2',
    ])
  })

  it('should not replace instance path for other metadataTypes', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      'some other metadataType'
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    await filter.onFetch([instance])
    expect(instance.path).toEqual(origInstance.path)
  })

  it('should not replace instance path if it has no path', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      PROFILE_METADATA_TYPE
    instance.value[INSTANCE_FULL_NAME_FIELD] = 'Admin'
    instance.value[INTERNAL_ID_FIELD] = 'AdminInternalId'
    instance.path = undefined
    await filter.onFetch([instance])
    expect(instance.path).toBeUndefined()
  })
  describe('when feature is throwing an error', () => {
    it('should return a warning', async () => {
      ;(await instance.getType()).annotations[METADATA_TYPE] =
        PROFILE_METADATA_TYPE
      instance.value[INSTANCE_FULL_NAME_FIELD] = 'PlatformPortal'
      instance.value[INTERNAL_ID_FIELD] = 'PlatformPortalInternalId'
      connection.query.mockImplementation(() => {
        throw new Error()
      })
      const res = (await filter.onFetch([instance])) as FilterResult
      const err = res.errors ?? []
      expect(res.errors).toHaveLength(1)
      expect(err[0]).toEqual({
        severity: 'Warning',
        message: WARNING_MESSAGE,
      })
    })
  })
  describe('when feature is disabled', () => {
    it('should not run any query when feature is disabled', async () => {
      ;(await instance.getType()).annotations[METADATA_TYPE] =
        PROFILE_METADATA_TYPE
      instance.value[INSTANCE_FULL_NAME_FIELD] = 'PlatformPortal'
      instance.value[INTERNAL_ID_FIELD] = 'PlatformPortalInternalId'
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { profilePaths: false } },
          }),
        },
      }) as FilterWith<'onFetch'>
      await filter.onFetch([instance])
      expect(instance.path).toEqual([
        SALESFORCE,
        RECORDS_PATH,
        PROFILE_METADATA_TYPE,
        'test',
      ])
      expect(connection.query).not.toHaveBeenCalled()
    })
  })
})
