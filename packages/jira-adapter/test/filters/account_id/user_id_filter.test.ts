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
import { BuiltinTypes, ElemID, ElemIdGetter, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import addDisplayNameFilter from '../../../src/filters/account_id/user_id_filter'
import * as common from './account_id_common'
import { ACCOUNT_ID_TYPES } from '../../../src/filters/account_id/account_id_filter'
import { AUTOMATION_TYPE, DASHBOARD_TYPE, JIRA } from '../../../src/constants'

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
      }, {
        accountId: '2operations1',
        displayName: 'disp2operations1',
      }, {
        accountId: '2automation1',
        displayName: 'disp2automation1',
      }, {
        accountId: '2automation2',
        displayName: 'disp2automation2',
      }, {
        accountId: '2automation3',
        displayName: 'disp2automation3',
      }, {
        accountId: '2automation4',
        displayName: 'disp2automation4',
      }, {
        accountId: '2automation5',
        displayName: 'disp2automation5',
      }, {
        accountId: '2automation6',
        displayName: 'disp2automation6',
      }, {
        accountId: '2automation7',
        displayName: 'disp2automation7',
      }, {
        accountId: '2automation8a',
        displayName: 'disp2automation8a',
      }, {
        accountId: '2automation8b',
        displayName: 'disp2automation8b',
      }, {
        accountId: '2automation9',
        displayName: 'disp2automation9',
      }, {
        accountId: '2owner',
        displayName: 'disp2owner',
      }, {
        accountId: '2users1',
        displayName: 'disp2users1',
      }, {
        accountId: '2users2',
        displayName: 'disp2users2',
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
      common.checkDisplayNames(instance, '2')
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

  const EMPTY_STRING = ''
  const NAME_PREFIX = 'name'

  let automationType: ObjectType
  let automationInstance: InstanceElement
  let dashboardType: ObjectType
  let dashboardInstance: InstanceElement
  let projectType: ObjectType
  let projectInstance: InstanceElement

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


    automationType = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_TYPE),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_TYPE),
      fields: {
        gadgets: {
          refType: BuiltinTypes.STRING,
        },

        layout: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    dashboardInstance = new InstanceElement(
      'instance',
      dashboardType,
      {
        id: '0',
        layout: 'AAA',
        gadgets: [
        ],
        editPermissions: {
          type: 'user',
          user: {
            accountId: {
              id: 'JIRAUSER10200',
            },
          },
        },
      }
    )

    automationInstance = new InstanceElement(
      'instance',
      automationType,
      {
        name: 'someName',
        state: 'ENABLED',
        projects: [
          {
            projectId: '1',
          },
        ],
        actorAccountId: 'JIRAUSER10100',
        authorAccountId: {
          id: 'JIRAUSER10100',
        },
      }
    )

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
      fields: {
        workflowScheme: { refType: BuiltinTypes.STRING },
        issueTypeScreenScheme: { refType: BuiltinTypes.STRING },
        fieldConfigurationScheme: { refType: BuiltinTypes.STRING },
        issueTypeScheme: { refType: BuiltinTypes.STRING },
        priorityScheme: { refType: BuiltinTypes.STRING },
        components: { refType: BuiltinTypes.STRING },
      },
    })
    projectInstance = new InstanceElement(
      'instance',
      projectType,
      {
        leadAccountId: {
          id: 'JIRAUSER10300',
        },
      }
    )

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
        key: 'JIRAUSER10100',
        name: 'salto',
      }, {
        key: 'JIRAUSER10200',
        name: 'admin',
      }, {
        key: 'JIRAUSER10300',
        name: 'projectLeadAccount',
      }],
    })
  })
  describe('fetch', () => {
    it('should convert all instances userId to key on fetch', async () => {
      expect(automationInstance.value.authorAccountId).toEqual({ id: 'JIRAUSER10100' })
      expect(dashboardInstance.value.editPermissions.user.accountId).toEqual({ id: 'JIRAUSER10200' })
      expect(projectInstance.value.leadAccountId).toEqual({ id: 'JIRAUSER10300' })

      await filter.onFetch([automationInstance, dashboardInstance, projectInstance])
      expect(mockConnection.get).toHaveBeenCalledOnce()
      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/api/2/user/search',
        {
          headers: undefined,
          params: {
            maxResults: '1000',
            username: '.',
          },
          responseType: undefined,
        }
      )
      expect(automationInstance.value.authorAccountId).toEqual({ id: 'salto' })
      expect(dashboardInstance.value.editPermissions.user.accountId).toEqual({ id: 'admin' })
      expect(projectInstance.value.leadAccountId).toEqual({ id: 'projectLeadAccount' })
    })
    it('should not convert only project instance key to userId on preDeploy and onDeploy', async () => {
      await filter.onFetch([automationInstance, dashboardInstance, projectInstance])
      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: dashboardInstance, after: dashboardInstance }),
        toChange({ after: projectInstance }),
      ])
      expect(mockConnection.get).toHaveBeenCalledOnce()
      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/api/2/user/search',
        {
          params: {
            maxResults: '1000',
            username: '.',
          },
          responseType: undefined,
        }
      )
      expect(automationInstance.value.authorAccountId).toEqual({ id: 'JIRAUSER10100' })
      expect(dashboardInstance.value.editPermissions.user.accountId).toEqual({ id: 'JIRAUSER10200' })
      expect(projectInstance.value.leadAccountId).toEqual({ id: 'projectLeadAccount' })
      await filter.onDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: dashboardInstance, after: dashboardInstance }),
        toChange({ after: projectInstance }),
      ])
      expect(mockConnection.get).toHaveBeenCalledOnce()
      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/api/2/user/search',
        {
          headers: undefined,
          params: {
            maxResults: '1000',
            username: '.',
          },
          responseType: undefined,
        }
      )
      expect(automationInstance.value.authorAccountId).toEqual({ id: 'salto' })
      expect(dashboardInstance.value.editPermissions.user.accountId).toEqual({ id: 'admin' })
      expect(projectInstance.value.leadAccountId).toEqual({ id: 'projectLeadAccount' })
    })
    it('should not convert userId to key or backwards for undefined types', async () => {
      const type = common.createType('Other')
      const instance = common.createObjectedInstance('2', type)
      await filter.onFetch([instance])
      common.checkInstanceUserIds(instance, '2', EMPTY_STRING)

      await filter.preDeploy([toChange({ after: instance })])
      common.checkInstanceUserIds(instance, '2', EMPTY_STRING)
      await filter.onDeploy([toChange({ after: instance })])
      common.checkInstanceUserIds(instance, '2', EMPTY_STRING)
    })
  })
})
