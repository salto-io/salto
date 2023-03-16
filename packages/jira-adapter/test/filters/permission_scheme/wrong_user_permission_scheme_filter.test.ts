/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange, Change, Value, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFilterParams, mockClient } from '../../utils'
import wrongUserPermissionSchemeFilter from '../../../src/filters/permission_scheme/wrong_user_permission_scheme_filter'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../../src/constants'

describe('wrongUsersPermissionSchemeFilter', () => {
  let instances: InstanceElement[]
  let changes: Change[]
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let elementsSource: ReadOnlyElementsSource
  beforeEach(async () => {
    jest.clearAllMocks()
    const usersType = new ObjectType({
      elemID: new ElemID(JIRA, 'Users'),
    })
    const usersElements = new InstanceElement(
      'users',
      usersType,
      {
        users: {
          id1: {
            accountId: 'id1',
            locale: 'en_US',
            displayName: 'name1',
          },
          id4: {
            accountId: 'id4',
            locale: 'en_US',
            displayName: 'name2',
          },
          id5: {
            accountId: 'id5',
            locale: 'en_US',
            displayName: 'name3',
          },
        },
      }
    )
    elementsSource = buildElementsSourceFromElements([usersElements])
    filter = wrongUserPermissionSchemeFilter(getFilterParams({ elementsSource })) as filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    const type = new ObjectType({
      elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
    })
    instances = []
    changes = []
    const value1: Value = { permissions: [] }
    const value2: Value = { permissions: [] }
    const createValue = (i: number): Value => ({
      holder: {
        type: 'type',
        parameter: {
          id: `id${i}`,
        },
      },
      permission: 'read',
    })
    for (let i = 0; i < 6; i += 1) {
      value1.permissions.push(createValue(i))
      value2.permissions.push(createValue(5 - i))
    }
    // add irrelevant info
    value1.permissions[5].holder.parameter.wrong = 'wrong'
    // add wrong structure
    value1.permissions.push({ wrong: { anotherWrong: 'anotherWrong' } })
    instances[0] = new InstanceElement(
      'instance',
      type,
      value1
    )
    instances[1] = new InstanceElement(
      'instance2',
      type,
      value2
    )
    changes[0] = toChange({ after: instances[0] })
    changes[1] = toChange({ after: instances[1] })
  })
  it('should remove permissions with wrong account ids', async () => {
    await filter.preDeploy(changes)
    expect(instances[0].value.permissions.length).toEqual(4)
    expect(instances[0].value.permissions[0].holder.parameter.id).toEqual('id1')
    expect(instances[0].value.permissions[1].holder.parameter.id).toEqual('id4')
    expect(instances[0].value.permissions[2].holder.parameter.id).toEqual('id5')
    expect(instances[0].value.permissions[3].wrong.anotherWrong).toEqual('anotherWrong')
    expect(instances[1].value.permissions.length).toEqual(3)
    expect(instances[1].value.permissions[2].holder.parameter.id).toEqual('id1')
    expect(instances[1].value.permissions[1].holder.parameter.id).toEqual('id4')
    expect(instances[1].value.permissions[0].holder.parameter.id).toEqual('id5')
  })
  it('should not raise error on empty users', async () => {
    filter = wrongUserPermissionSchemeFilter(
      getFilterParams({ elementsSource: buildElementsSourceFromElements([]) })
    ) as filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    await expect(filter.preDeploy(changes)).resolves.not.toThrow()
  })
  it('should return removed permissions in the right order', async () => {
    await filter.preDeploy(changes)
    await filter.onDeploy(changes)
    expect(instances[0].value.permissions.length).toEqual(7)
    expect(instances[1].value.permissions.length).toEqual(6)
    for (let i = 0; i < 6; i += 1) {
      expect(instances[0].value.permissions[i].holder.parameter.id).toEqual(`id${i}`)
    }
    for (let i = 0; i < 6; i += 1) {
      expect(instances[1].value.permissions[5 - i].holder.parameter.id).toEqual(`id${i}`)
    }
    expect(instances[0].value.permissions[5].holder.parameter.wrong).toEqual('wrong')
    expect(instances[0].value.permissions[6].wrong.anotherWrong).toEqual('anotherWrong')
  })
  it('flag off', async () => {
    const configFFOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    configFFOff.fetch.convertUsersIds = false
    const { paginator: paginFFOff, connection: connectionFFOff } = mockClient()
    const filterFFOff = wrongUserPermissionSchemeFilter(getFilterParams({
      paginator: paginFFOff,
      config: configFFOff,
    })) as typeof filter
    await filterFFOff.onDeploy(changes)
    expect(connectionFFOff.get).not.toHaveBeenCalled()
    expect(instances[0].value.permissions.length).toEqual(7)
    expect(instances[1].value.permissions.length).toEqual(6)
  })
})
