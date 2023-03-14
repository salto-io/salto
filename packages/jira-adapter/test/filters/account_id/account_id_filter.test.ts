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
import { BuiltinTypes, Change, ElemID, ElemIdGetter, Field, getChangeData, InstanceElement, ListType, ModificationChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { filterUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, ACCOUNT_IDS_FIELDS_NAMES } from '../../../src/constants'
import accountIdFilter, { ACCOUNT_ID_TYPES } from '../../../src/filters/account_id/account_id_filter'
import * as common from './account_id_common'

const { awu } = collections.asynciterable

describe('account_id_filter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let elemIdGetter: jest.MockedFunction<ElemIdGetter>
  let config: JiraConfig

  let objectType: ObjectType
  let changedObjectType: ObjectType

  let displayNamesInstances: InstanceElement[] = []
  let simpleInstances: InstanceElement[] = []
  let displayChanges: Change<InstanceElement>[]

  let filterInstance: InstanceElement
  let dashboardInstance: InstanceElement
  let boardInstance: InstanceElement
  let fieldContextInstance: InstanceElement

  beforeEach(() => {
    elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    const { client, paginator } = mockClient()
    filter = accountIdFilter(getFilterParams({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
    })) as typeof filter

    objectType = common.createType('PermissionScheme') // passes 3rd condition
    changedObjectType = common.createObjectedType('NotificationScheme') // passes 3rd condition

    displayNamesInstances = common.createInstanceElementArrayWithDisplayNames(4, changedObjectType)
    simpleInstances = []
    for (let i = 0; i < 4; i += 1) {
      simpleInstances[i] = common.createInstance(i.toString(), objectType)
    }
    filterInstance = new InstanceElement(
      'filterInstance',
      common.createFilterType(),
      {
        owner: 'acc2',
      }
    )
    boardInstance = new InstanceElement(
      'boardInstance',
      common.createBoardType(),
      {
        admins: {
          users: ['acc3', 'acc31'],
        },
      }
    )
    dashboardInstance = new InstanceElement(
      'instance3',
      common.createDashboardType(),
      {
        inner: {
          owner: 'acc4',
        },
      }
    )
    fieldContextInstance = new InstanceElement(
      'instance',
      common.createFieldContextType(),
      {
        defaultValue: {
          accountId: 'acc5',
        },
      }
    )

    displayChanges = [
      toChange({ after: displayNamesInstances[0] }),
      toChange({ before: displayNamesInstances[1], after: displayNamesInstances[2] }),
    ]
  })
  describe('fetch', () => {
    it('changes instance element structures for all 5 types', async () => {
      await filter.onFetch([simpleInstances[1], filterInstance, dashboardInstance, boardInstance, fieldContextInstance])
      common.checkObjectedInstanceIds(simpleInstances[1], '1')
      expect(filterInstance.value.owner.id).toEqual('acc2')
      expect(boardInstance.value.admins.users[0].id).toEqual('acc3')
      expect(boardInstance.value.admins.users[1].id).toEqual('acc31')
      expect(dashboardInstance.value.inner.owner.id).toEqual('acc4')
      expect(fieldContextInstance.value.defaultValue.accountId.id).toEqual('acc5')
    })
    it('should change account ids in all defined types', async () => {
      await awu(ACCOUNT_ID_TYPES).forEach(async typeName => {
        const type = common.createType(typeName)
        const instance = common.createInstance('1', type)
        await filter.onFetch([instance])
        common.checkObjectedInstanceIds(instance, '1')
      })
    })
    it('should not change account ids for undefined types', async () => {
      const type = common.createType('Other')
      const instance = common.createInstance('1', type)
      await filter.onFetch([instance])
      common.checkSimpleInstanceIds(instance, '1')
    })
    it('should enhance types with relevant account ids', async () => {
      const currentObjectType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContext'),
      })
      ACCOUNT_IDS_FIELDS_NAMES.forEach(fieldName => {
        currentObjectType.fields[fieldName] = new Field(
          currentObjectType,
          fieldName,
          BuiltinTypes.STRING
        )
      })
      currentObjectType.fields.accountIds = new Field(
        currentObjectType,
        'accountIds',
        new ListType(BuiltinTypes.STRING)
      )
      await filter.onFetch([currentObjectType])
      await awu(ACCOUNT_IDS_FIELDS_NAMES).forEach(async fieldName => {
        const currentType = await currentObjectType.fields[fieldName].getType() as ObjectType
        expect(Object.prototype.hasOwnProperty.call(currentType.fields, 'id')).toBeTruthy()
        expect(Object.prototype.hasOwnProperty.call(currentType.fields, 'displayName')).toBeTruthy()
        expect(currentType.elemID.getFullName()).toEqual('jira.AccountIdInfo')
      })
      expect((await currentObjectType.fields.accountIds.getType()).elemID.getFullName()).toEqual('List<jira.AccountIdInfo>')
    })
    it('should not enhance types with account ids that are not part of the known types', async () => {
      const currentObjectType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContext'),
        fields: {
          fakeAccountId: { refType: BuiltinTypes.STRING },
        },
      })
      await filter.onFetch([currentObjectType])
      expect(await currentObjectType.fields.fakeAccountId.getType()).toEqual(BuiltinTypes.STRING)
    })
  })
  describe('deploy', () => {
    it('returns account id structure to a simple and correct string on pre deploy on all 5 types', async () => {
      await filter.preDeploy(displayChanges)
      common.checkSimpleInstanceIds(getChangeData(displayChanges[0]), '0')
      common.checkObjectedInstanceIds((displayChanges[1] as ModificationChange<InstanceElement>).data.before, '1')
      common.checkSimpleInstanceIds((displayChanges[1] as ModificationChange<InstanceElement>).data.after, '2')
    })
    it('does not change non deployable objects on deploy', async () => {
      await filter.onFetch([boardInstance])
      displayChanges.push(toChange({ after: boardInstance }))
      await filter.preDeploy(displayChanges)
      expect(boardInstance.value.admins.users[0].id).toEqual('acc3')
      expect(boardInstance.value.admins.users[1].id).toEqual('acc31')
      await filter.onDeploy(displayChanges)
      expect(boardInstance.value.admins.users[0].id).toEqual('acc3')
      expect(boardInstance.value.admins.users[1].id).toEqual('acc31')
    })
    it('does not change removal objects', async () => {
      await filter.preDeploy([toChange({ before: displayNamesInstances[1] })])
      common.checkObjectedInstanceIds(displayNamesInstances[1], '1')
    })
    it('re-enhances instances on onDeploy', async () => {
      await filter.preDeploy(displayChanges)
      await filter.onDeploy(displayChanges)
      common.checkObjectedInstanceIds(getChangeData(displayChanges[0]), '0')
      common.checkDisplayNames(getChangeData(displayChanges[0]), '0')
      common.checkObjectedInstanceIds((displayChanges[1] as ModificationChange<InstanceElement>).data.before, '1')
      common.checkDisplayNames((displayChanges[1] as ModificationChange<InstanceElement>).data.before, '1')
      common.checkObjectedInstanceIds((displayChanges[1] as ModificationChange<InstanceElement>).data.after, '2')
      common.checkDisplayNames((displayChanges[1] as ModificationChange<InstanceElement>).data.after, '2')
    }, 1000000)
    it('returns even wrong structure instances on OnDeploy', async () => {
      const elementInstance = displayNamesInstances[0]
      elementInstance.value.accountId.wrong = 'wrong'
      elementInstance.value.nested.actor2.value.wrong = 'wrong'
      const changes = [toChange({ after: elementInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      common.checkObjectedInstanceIds(elementInstance, '0')
      common.checkDisplayNames(elementInstance, '0')
      expect(elementInstance.value.accountId.wrong).toEqual('wrong')
      expect(elementInstance.value.nested.actor2.value.wrong).toEqual('wrong')
    })
  })
})
