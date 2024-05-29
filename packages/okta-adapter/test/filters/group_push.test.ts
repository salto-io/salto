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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  isInstanceElement,
  CORE_ANNOTATIONS,
  ListType,
  BuiltinTypes,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import groupPushFilter from '../../src/filters/group_push'
import { APPLICATION_TYPE_NAME, GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME, OKTA } from '../../src/constants'

describe('groupPushFilter', () => {
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
  const groupPushType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME) })
  const pushRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_RULE_TYPE_NAME) })
  const groupPushA = new InstanceElement(
    'g1',
    groupPushType,
    { mappingId: 'm1', status: 'ACTIVE', userGroupId: 'g1', newAppGroupName: 'A1', groupPushRule: 'r1' },
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
  beforeEach(() => {
    filter = groupPushFilter(getFilterParams()) as typeof filter
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
