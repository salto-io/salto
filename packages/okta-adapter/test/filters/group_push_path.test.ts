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
  Element,
  InstanceElement,
  ObjectType,
  CORE_ANNOTATIONS,
  ListType,
  BuiltinTypes,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { elements as elementUtils, filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import { APPLICATION_TYPE_NAME, GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME, OKTA } from '../../src/constants'
import groupPushPathFilter from '../../src/filters/group_push_path'

describe('groupPushPathFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      features: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })
  const appWithGroupPush = new InstanceElement(
    'regular app',
    appType,
    {
      id: 'abc',
      status: 'ACTIVE',
      name: 'salesforce',
      signOnMode: 'SAML_2_0',
      features: ['IMPORT_USER_SCHEMA', 'GROUP_PUSH'],
    },
    [OKTA, elementUtils.RECORDS_PATH, APPLICATION_TYPE_NAME, 'regular_app', 'regular_app'],
  )
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
    'testRule',
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

  it('should modify group push path to be nested under the parent app', async () => {
    const elements: Element[] = [appType, groupPushType, pushRuleType, appWithGroupPush, groupPushA, pushRuleInstance]
    filter = groupPushPathFilter(getFilterParams()) as typeof filter
    await filter.onFetch(elements)
    const groupPush = elements.filter(isInstanceElement).find(i => i.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    expect(groupPush?.path).toEqual([
      OKTA,
      elementUtils.RECORDS_PATH,
      APPLICATION_TYPE_NAME,
      'regular_app',
      GROUP_PUSH_TYPE_NAME,
      'g1',
    ])
    const groupPushRule = elements.filter(isInstanceElement).find(i => i.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME)
    expect(groupPushRule?.path).toEqual([
      OKTA,
      elementUtils.RECORDS_PATH,
      APPLICATION_TYPE_NAME,
      'regular_app',
      GROUP_PUSH_RULE_TYPE_NAME,
      'testRule',
    ])
  })
  it('it should do nothing if there is no parent app', async () => {
    const elements: Element[] = [
      groupPushType,
      new InstanceElement('noParent', groupPushType, { id: 3 }, [
        OKTA,
        elementUtils.RECORDS_PATH,
        GROUP_PUSH_TYPE_NAME,
        'noParent',
      ]),
    ]
    filter = groupPushPathFilter(getFilterParams()) as typeof filter
    await filter.onFetch(elements)
    const groupPush = elements.filter(isInstanceElement).find(i => i.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    expect(groupPush?.path).toEqual([OKTA, elementUtils.RECORDS_PATH, GROUP_PUSH_TYPE_NAME, 'noParent'])
  })
})
