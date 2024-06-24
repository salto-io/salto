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
import { ElemID, ElemIdGetter, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
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
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let withUUIDInstance: InstanceElement
  let withoutUUIDInstance: InstanceElement

  const type = new ObjectType({
    elemID: new ElemID(JIRA, GROUP_TYPE_NAME),
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    mockGetConfigWithDefault.mockReturnValue({ serviceIdField: 'groupId' })
    const elemIdGetter = mockFunction<ElemIdGetter>().mockImplementation(
      (adapterName, _serviceIds, name) => new ElemID(adapterName, name),
    )
    filter = groupNameFilter({ ...getFilterParams(), getElemIdFunc: elemIdGetter }) as typeof filter

    withUUIDInstance = new InstanceElement('trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b@b', type, {
      name: 'trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b',
    })
    withoutUUIDInstance = new InstanceElement('normal', type, {
      name: 'normal',
    })
    withUUIDInstance.path = ['trusted_users_128baddc_c238_4857_b249_cfc84bd10c4b@b']
  })
  it('should not change anything if there is more than one trusted users group', async () => {
    const dup = new InstanceElement('trusted-users-123baddc-c123-1234-b249-cfc84bd10c4b@b', type, {
      name: 'trusted-users-123baddc-c123-1234-b249-cfc84bd10c4b',
    })
    const elements = [withUUIDInstance, dup, withoutUUIDInstance]
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.getFullName())).toEqual([
      'jira.Group.instance.trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b@b',
      'jira.Group.instance.trusted-users-123baddc-c123-1234-b249-cfc84bd10c4b@b',
      'jira.Group.instance.normal',
    ])
  })
  it('should remove uuid suffix from element name, file name and field into a new field', async () => {
    const elements = [withUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].elemID.name).toEqual('trusted_users@b')
    expect(elements[0].path).toEqual(['jira', 'Records', 'Group', 'trusted_users'])
    expect(elements[0].value.name).toEqual('trusted-users')
    expect(elements[0].value.originalName).toEqual('trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b')
  })
  it('should not change the name if there is no uuid in it', async () => {
    const elements = [withoutUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].elemID.name).toEqual('normal')
  })
  it('change element file name to not have uuid', async () => {
    withUUIDInstance.path = undefined
    const elements = [withUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].path).toEqual(['jira', 'Records', 'Group', 'trusted_users'])
  })
  it('should update original name field for all group instances', async () => {
    const elements = [withUUIDInstance, withoutUUIDInstance]
    await filter.onFetch(elements)
    expect(elements[0].value.originalName).toEqual('normal')
    expect(elements[1].value.originalName).toEqual('trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b')
  })

  it('onDeploy should add originalName when addition', async () => {
    await filter.onDeploy([toChange({ after: withUUIDInstance })])
    expect(withUUIDInstance.value.name).toEqual('trusted-users')
    expect(withUUIDInstance.value.originalName).toEqual('trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b')
  })

  it('onDeploy should not add originalName when not addition', async () => {
    await filter.onDeploy([toChange({ before: withUUIDInstance })])
    expect(withUUIDInstance.value.originalName).toBeUndefined()
  })

  it('onDeploy should not add originalName when not group type', async () => {
    withUUIDInstance = new InstanceElement(
      'trusted_users_128baddc_c238_4857_b249_cfc84bd10c4b@b',
      new ObjectType({ elemID: new ElemID(JIRA, 'not_group_type') }),
      {
        name: 'trusted-users-128baddc-c238-4857-b249-cfc84bd10c4b',
      },
    )
    await filter.onDeploy([toChange({ after: withUUIDInstance })])
    expect(withUUIDInstance.value.originalName).toBeUndefined()
  })
})
