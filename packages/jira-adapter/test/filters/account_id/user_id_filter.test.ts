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
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import addDisplayNameFilter from '../../../src/filters/account_id/user_id_filter'
import * as common from './account_id_common'
import { ACCOUNT_ID_TYPES, PARAMETER_STYLE_TYPES } from '../../../src/filters/account_id/account_id_filter'

const { awu } = collections.asynciterable

describe('add_display_name_filter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let elemIdGetter: jest.MockedFunction<ElemIdGetter>
  let config: JiraConfig

  let objectType: ObjectType
  let instances: InstanceElement[] = []

  beforeEach(() => {
    elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const { client, paginator, connection, getIdMapFunc } = mockClient()
    mockConnection = connection
    filter = addDisplayNameFilter(getFilterParams({
      client,
      paginator,
      config,
      getIdMapFunc,
      getElemIdFunc: elemIdGetter,
    })) as typeof filter


    objectType = common.createObjectedType('SecurityLevel')

    instances = []
    for (let i = 0; i < 4; i += 1) {
      instances[i] = common.createObjectedInstance(i.toString(), objectType)
    }

    mockConnection.get.mockResolvedValue({
      status: 200,
      data: [{
        accountId: '2',
        displayName: 'disp2',
      }, {
        accountId: '2n',
        displayName: 'disp2n',
      }, {
        accountId: '22',
        displayName: 'disp22',
      }, {
        accountId: '22n',
        displayName: 'disp22n',
      }, {
        accountId: '2l',
        displayName: 'disp2l',
      }, {
        accountId: '2an',
        displayName: 'disp2an',
      }, {
        accountId: '2h',
        displayName: 'disp2h',
      }, {
        accountId: '2list1',
        displayName: 'disp2list1',
      }, {
        accountId: '2list2',
        displayName: 'disp2list2',
      }],
    })
  })
  it('should only call once in fetch when there are multiple objects with accountId', async () => {
    await filter.onFetch(instances)
    expect(mockConnection.get).toHaveBeenCalledOnce()
  })
  describe('feature flag', () => {
    let filterFFOff: filterUtils.FilterWith<'onFetch'>
    let configFFOff: JiraConfig
    let connectionFFOff: MockInterface<clientUtils.APIConnection>

    beforeEach(() => {
      configFFOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configFFOff.fetch.convertUsersIds = false
      const { client, paginator, connection } = mockClient()
      connectionFFOff = connection
      filterFFOff = addDisplayNameFilter(getFilterParams({
        client,
        paginator,
        config: configFFOff,
        getElemIdFunc: elemIdGetter,
      })) as typeof filter
    })
    it('should not call for users', async () => {
      await filterFFOff.onFetch(instances)
      expect(connectionFFOff.get).not.toHaveBeenCalled()
    })
    it('should not change objects on fetch', async () => {
      await filterFFOff.onFetch(instances)
      instances.forEach(instance => {
        expect(instance.value.accountId.displayName).toBeUndefined()
        expect(instance.value.leadAccountId.displayName).toBeUndefined()
        expect(instance.value.actor.value.displayName).toBeUndefined()
        expect(instance.value.nested.accountId.displayName).toBeUndefined()
        expect(instance.value.nested.authorAccountId.displayName).toBeUndefined()
        expect(instance.value.nested.actor2.value.displayName).toBeUndefined()
        expect(instance.value.holder.parameter.displayName).toBeUndefined()
        expect(instance.value.list[0].accountId.displayName).toBeUndefined()
        expect(instance.value.list[1].accountId.displayName).toBeUndefined()
      })
    })
  })
  it('adds display name on fetch for all 5 types', async () => {
    await filter.onFetch([instances[2]])
    expect(mockConnection.get).toHaveBeenCalledOnce()
    expect(mockConnection.get).toHaveBeenCalledWith(
      '/rest/api/3/users/search',
      undefined
    )
    common.checkDisplayNames(instances[2], '2')
  })
  it('should add display name in all defined types', async () => {
    await awu(ACCOUNT_ID_TYPES).forEach(async typeName => {
      const type = common.createType(typeName)
      const instance = common.createObjectedInstance('2', type)
      await filter.onFetch([instance])
      common.checkDisplayNames(instance, '2', PARAMETER_STYLE_TYPES.includes(typeName))
    })
  })
  it('should not add display names for undefined types', async () => {
    const type = common.createType('Other')
    const instance = common.createObjectedInstance('2', type)
    await filter.onFetch([instance])

    expect(instance.value.accountId.displayName).toBeUndefined()
    expect(instance.value.leadAccountId.displayName).toBeUndefined()
    expect(instance.value.actor.value.displayName).toBeUndefined()
    expect(instance.value.nested.accountId.displayName).toBeUndefined()
    expect(instance.value.nested.authorAccountId.displayName).toBeUndefined()
    expect(instance.value.nested.actor2.value.displayName).toBeUndefined()
    expect(instance.value.holder.parameter.displayName).toBeUndefined()
    expect(instance.value.list[0].accountId.displayName).toBeUndefined()
    expect(instance.value.list[1].accountId.displayName).toBeUndefined()
  })
})

describe('convert userId to key in Jira DC', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let elemIdGetter: jest.MockedFunction<ElemIdGetter>
  let config: JiraConfig

  let objectType: ObjectType
  let instances: InstanceElement[] = []
  const EMPTY_STRING = ''
  const NAME_PREFIX = 'name'

  beforeEach(() => {
    elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client, paginator, connection, getIdMapFunc } = mockClient(true)
    mockConnection = connection
    filter = addDisplayNameFilter(getFilterParams({
      client,
      paginator,
      config,
      getIdMapFunc,
      getElemIdFunc: elemIdGetter,
    })) as typeof filter


    objectType = common.createObjectedType('SecurityLevel')


    instances = []
    for (let i = 0; i < 3; i += 1) {
      instances[i] = common.createObjectedInstance(i.toString(), objectType)
    }

    mockConnection.get.mockResolvedValue({
      status: 200,
      data: [{
        key: '2',
        name: `${NAME_PREFIX}2`,
      }, {
        key: '2l',
        name: `${NAME_PREFIX}2l`,
      }, {
        key: '2n',
        name: `${NAME_PREFIX}2n`,
      }, {
        key: '2an',
        name: `${NAME_PREFIX}2an`,
      }, {
        key: '22n',
        name: `${NAME_PREFIX}22n`,
      }, {
        key: '22',
        name: `${NAME_PREFIX}22`,
      }, {
        key: '2h',
        name: `${NAME_PREFIX}2h`,
      }, {
        key: '2list1',
        name: `${NAME_PREFIX}2list1`,
      }, {
        key: '2list2',
        name: `${NAME_PREFIX}2list2`,
      }, {
        key: '0',
        name: `${NAME_PREFIX}0`,
      }, {
        key: '0l',
        name: `${NAME_PREFIX}0l`,
      }, {
        key: '0n',
        name: `${NAME_PREFIX}0n`,
      }, {
        key: '0an',
        name: `${NAME_PREFIX}0an`,
      }, {
        key: '00n',
        name: `${NAME_PREFIX}00n`,
      }, {
        key: '00',
        name: `${NAME_PREFIX}00`,
      }, {
        key: '0h',
        name: `${NAME_PREFIX}0h`,
      }, {
        key: '0list1',
        name: `${NAME_PREFIX}0list1`,
      }, {
        key: '0list2',
        name: `${NAME_PREFIX}0list2`,
      }],
    })
  })
  describe('fetch', () => {
    it('should convert userId to key and backwards for all 5 types', async () => {
      await filter.onFetch([instances[2]])
      expect(mockConnection.get).toHaveBeenCalledOnce()
      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/api/2/user/search?username=.',
        undefined
      )
      common.checkInstanceUserIds(instances[2], '2', NAME_PREFIX)
    })
    it('should convert userId to key and backwards in all defined types', async () => {
      await awu(ACCOUNT_ID_TYPES).forEach(async typeName => {
        const type = common.createType(typeName)
        const instance = common.createObjectedInstance('2', type)
        await filter.onFetch([instance])
        common.checkInstanceUserIds(instance, '2', NAME_PREFIX, PARAMETER_STYLE_TYPES.includes(typeName))
      })
    })
    it('should not convert userId to key or backwards for undefined types', async () => {
      const type = common.createType('Other')
      const instance = common.createObjectedInstance('2', type)
      await filter.onFetch([instance])
      common.checkInstanceUserIds(instances[2], '2', EMPTY_STRING)
    })
  })
})
