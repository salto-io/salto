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

import _ from 'lodash'
import {
  ElemID,
  Element,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  isInstanceElement,
  isObjectType,
  CORE_ANNOTATIONS,
  ListType,
  BuiltinTypes,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import OktaClient from '../../src/client/client'
import groupPushFilter from '../../src/filters/group_push'
import { APPLICATION_TYPE_NAME, GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME, OKTA } from '../../src/constants'
import { DEFAULT_CONFIG, CLIENT_CONFIG } from '../../src/config'

describe('groupPushFilter', () => {
  let mockGet: jest.SpyInstance
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      features: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })
  const appWithGroupPush = new InstanceElement('regular app', appType, {
    id: 'abc',
    status: 'ACTIVE',
    name: 'salesforce',
    signOnMode: 'SAML_2_0',
    features: ['IMPORT_USER_SCHEMA', 'GROUP_PUSH'],
  })
  const appWithNoGroupPush = new InstanceElement('regular app', appType, {
    id: 'bcd',
    status: 'ACTIVE',
    name: 'salesforce',
    signOnMode: 'SAML_2_0',
    features: ['IMPORT_USER_SCHEMA'],
  })
  const inactiveApp = new InstanceElement('regular app', appType, {
    id: 'cde',
    status: 'INACTIVE',
    name: 'zendesk',
    signOnMode: 'SAML_2_0',
    features: ['GROUP_PUSH'],
  })
  const groupPushType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME) })
  const pushRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_RULE_TYPE_NAME) })
  const groupPushA = new InstanceElement(
    'g1',
    groupPushType,
    { mappingId: 'm1', status: 'ACTIVE', userGroupId: 'g1', newAppGroupName: 'A1', groupPushRule: 'r1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithGroupPush.elemID, appWithGroupPush)] },
  )
  const groupPushB = new InstanceElement(
    'g2',
    groupPushType,
    { mappingId: 'm2', status: 'INACTIVE', userGroupId: 'g2', newAppGroupName: 'B1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithGroupPush.elemID, appWithGroupPush)] },
  )
  const pushRuleInstance = new InstanceElement(
    'test rule',
    pushRuleType,
    {
      mappingRuleId: 'mr1',
      name: 'test rule',
      status: 'ACTIVE',
      searchExpression: 'sales',
      searchExpressionType: 'ENDS_WITH',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithGroupPush.elemID, appWithGroupPush)] },
  )

  describe('fetch', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      client = new OktaClient({
        credentials: { baseUrl: 'a.okta.com', token: 'b' },
      })
      mockGet = jest.spyOn(client, 'get')
    })
    it('should do nothing if usePrivateApi config flag is disabled', async () => {
      const elements: Element[] = [appType, appWithGroupPush, appWithNoGroupPush]
      const config = _.cloneDeep(DEFAULT_CONFIG)
      config[CLIENT_CONFIG] = { usePrivateAPI: false }
      filter = groupPushFilter(getFilterParams({ client, config })) as typeof filter
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)
    })
    it('should do nothing if admin client is', async () => {
      const elements: Element[] = [appType, appWithGroupPush, appWithNoGroupPush]
      filter = groupPushFilter(getFilterParams({ adminClient: undefined })) as typeof filter
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)
    })
    it('should create group push type and group push rule type', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/api/internal/instance/abc/grouppush') {
          return {
            status: 200,
            data: { mappings: [], nextMappingsPageUrl: null },
          }
        }
        return { status: 200, data: [] }
      })
      const elements = [appType, appWithNoGroupPush, appWithGroupPush]
      filter = groupPushFilter(getFilterParams({ adminClient: client })) as typeof filter
      await filter.onFetch(elements)
      const types = elements.filter(isObjectType)
      expect(types).toHaveLength(3)
      expect(types.map(type => type.elemID.typeName)).toEqual(['Application', 'GroupPush', 'GroupPushRule'])
    })
    it('should create group push and group push rule instances', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/api/internal/instance/abc/grouppush') {
          return {
            status: 200,
            data: {
              mappings: [
                {
                  mappingId: 'm1',
                  status: 'ACTIVE',
                  createdBy: { id: 'u1' },
                  sourceUserGroupId: 'g1',
                  targetGroupName: 'A1',
                  ruleId: 'r1',
                },
                {
                  mappingId: 'm2',
                  status: 'INACTIVE',
                  createdBy: { id: 'u1' },
                  sourceUserGroupId: 'g2',
                  targetGroupName: 'B1',
                },
              ],
              nextMappingsPageUrl: null,
            },
          }
        }
        return {
          status: 200,
          data: [
            {
              mappingRuleId: 'mr1',
              status: 'ACTIVE',
              name: 'test rule',
              searchExpression: 'sales',
              searchExpressionType: 'ENDS_WITH',
            },
          ],
        }
      })
      const elements: Element[] = [appType, appWithNoGroupPush, appWithGroupPush]
      filter = groupPushFilter(getFilterParams({ adminClient: client })) as typeof filter
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      expect(instances).toHaveLength(5)
      const groupPushInstances = instances.filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
      expect(groupPushInstances).toHaveLength(2)
      expect(groupPushInstances[0].value).toEqual(groupPushA.value)
      expect(groupPushInstances[1].value).toEqual(groupPushB.value)
      const pushRuleInstances = instances.filter(instance => instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME)
      expect(pushRuleInstances).toHaveLength(1)
      expect(pushRuleInstances[0].value).toEqual(pushRuleInstance.value)
    })
    it('should not fetch group push rules for inactive apps', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/api/internal/instance/cde/grouppush') {
          return {
            status: 200,
            data: { mappings: [], nextMappingsPageUrl: null },
          }
        }
        throw new Error('unexpected')
      })
      const elements: Element[] = [appType, inactiveApp]
      filter = groupPushFilter(getFilterParams({ adminClient: client })) as typeof filter
      await filter.onFetch(elements)
      // Only 1 call for grouppush
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/internal/instance/cde/grouppush' }))
      expect(mockGet).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/internal/instance/cde/grouppushrules' }),
      )
    })
  })

  describe('preDeploy', () => {
    it('should add properties to removal changes', async () => {
      const changes = [toChange({ before: groupPushA.clone() }), toChange({ before: pushRuleInstance.clone() })]
      await filter.preDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances).toHaveLength(2)
      expect(instances.map(instance => instance.value)).toEqual([
        { deleteAppGroup: true, ...groupPushA.value },
        { action: 'DELETE_MAPPINGS_AND_DELETE_APP_GROUPS', ...pushRuleInstance.value },
      ])
    })
  })

  describe('onDeploy', () => {
    it('should delete the properties added during onDeploy', async () => {
      const groupPushInst = groupPushA.clone()
      groupPushInst.value.deleteAppGroup = true
      const pushRuleInst = pushRuleInstance.clone()
      pushRuleInst.value.action = 'DELETE_MAPPINGS_AND_DELETE_APP_GROUPS'
      const changes = [toChange({ before: groupPushInst }), toChange({ before: pushRuleInst })]
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value.deleteAppGroup).toBeUndefined()
      expect(instances[1].value.action).toBeUndefined()
    })
  })
})
