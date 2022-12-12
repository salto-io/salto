/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, ElemIdGetter, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { GROUP_TYPE_NAME, JIRA } from '../../src/constants'
import groupNameFilter from '../../src/filters/group_name'
import { getFilterParams } from '../utils'

const mockGetConfigWithDefault = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    config: {
      ...actual.config,
      getConfigWithDefault: jest.fn(args => mockGetConfigWithDefault(args)),
    },
  }
})

describe('group name filter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const type = new ObjectType({
    elemID: new ElemID(JIRA, GROUP_TYPE_NAME),
  })
  const withUUIDInstance = new InstanceElement(
    'trusted_users_128baddc_c238_4857_b249_cfc84bd10c4b@b',
    type,
    {
      name: 'trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b',
    }
  )
  const withoutUUIDInstance = new InstanceElement(
    'normal',
    type,
    {
      name: 'normal',
    }
  )
  withUUIDInstance.path = ['trusted_users_128baddc_c238_4857_b249_cfc84bd10c4b@b']
  beforeEach(async () => {
    mockGetConfigWithDefault.mockReturnValue({ serviceIdField: 'groupId' })
    const elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))
    filter = groupNameFilter({ ...getFilterParams(), getElemIdFunc: elemIdGetter }) as typeof filter
  })
  it('should remove uuid suffix from element name, file name and field into a new field', async () => {
    const elements = [withUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].elemID.name).toEqual('trusted_users@b')
    expect(elements[0].path).toEqual(['trusted_users'])
    expect(elements[0].value.name).toEqual('trusted-users')
    expect(elements[0].value.originalName).toEqual('trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b')
  })
  it('should not change the name if there is no uuid in it', async () => {
    const elements = [withoutUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].elemID.name).toEqual('normal')
  })
  // it('should use empty list if no path is available', async () => {
  //   const elements = [withoutUUIDInstance]
  //   await filter.onFetch(elements)
  //   expect(elements[0].elemID.name).toEqual('normal')
  // })
  it('should not change the name there is no service id in config', async () => {
    mockGetConfigWithDefault.mockReturnValue({ serviceIdField: undefined })
    const elements = [withUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].elemID.name).toEqual('trusted_users_128baddc_c238_4857_b249_cfc84bd10c4b@b')
  })
  it('change element file name to not have uuid', async () => {
    withUUIDInstance.path = undefined
    const elements = [withUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].path).toEqual(['trusted_users'])
  })
})
