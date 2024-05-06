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
  CORE_ANNOTATIONS,
  ElemID,
  ElemIdGetter,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { filterUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import renameDefaultAccessPolicy from '../../src/filters/rename_default_access_policy'
import { getFilterParams } from '../utils'
import { OKTA, ACCESS_POLICY_TYPE_NAME, ACCESS_POLICY_RULE_TYPE_NAME } from '../../src/constants'

describe('renameDefaultAccessPolicy', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let type: ObjectType
  let ruleType: ObjectType
  let elemIdGetter: jest.MockedFunction<ElemIdGetter>
  beforeEach(() => {
    elemIdGetter = mockFunction<ElemIdGetter>().mockImplementation(
      (adapterName, _serviceIds, name) => new ElemID(adapterName, name),
    )

    filter = renameDefaultAccessPolicy(getFilterParams({ getElemIdFunc: elemIdGetter })) as typeof filter

    type = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
    ruleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  })

  it('should rename the default access policy and its children rules', async () => {
    const custom = new InstanceElement(
      'customized default policy name',
      type,
      {
        name: 'customized name',
        system: true,
        type: 'ACCESS_POLICY',
      },
      [
        OKTA,
        'Records',
        ACCESS_POLICY_TYPE_NAME,
        pathNaclCase(naclCase('customized name')),
        pathNaclCase(naclCase('customized name')),
      ],
    )
    const rule = new InstanceElement(
      'customized_name__rule',
      ruleType,
      { name: 'rule', priority: 3 },
      [
        OKTA,
        'Records',
        ACCESS_POLICY_TYPE_NAME,
        pathNaclCase(naclCase('customized name')),
        'policyRules',
        pathNaclCase(naclCase('customized_name__rule')),
      ],
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(custom.elemID, custom)],
      },
    )

    const elements = [custom, type, ruleType, rule]
    await filter.onFetch(elements)
    const accesPolicies = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
    expect(accesPolicies).toHaveLength(1)
    expect(accesPolicies[0].elemID.name).toEqual('Default_Policy@s')
    expect(accesPolicies[0].path).toEqual([OKTA, 'Records', 'AccessPolicy', 'Default_Policy', 'Default_Policy'])

    const accesRules = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
    expect(accesRules).toHaveLength(1)
    expect(accesRules[0].elemID.name).toEqual('Default_Policy__rule@suu')
    expect((accesRules[0].annotations[CORE_ANNOTATIONS.PARENT]?.[0] as ReferenceExpression).elemID).toEqual(
      accesPolicies[0].elemID,
    )
    expect(accesRules[0].path).toEqual([
      OKTA,
      'Records',
      'AccessPolicy',
      'Default_Policy',
      'policyRules',
      'Default_Policy__rule',
    ])
  })

  it('should not rename non default policies and its children rules', async () => {
    const custom = new InstanceElement(
      'my_policy@s',
      type,
      {
        name: 'my policy',
        system: false,
        type: 'ACCESS_POLICY',
      },
      [OKTA, 'Records', 'AccessPolicy', pathNaclCase('my_policy@s'), pathNaclCase('my_policy@s')],
    )
    const rule = new InstanceElement(
      'my_policy__rule',
      ruleType,
      { name: 'rule', priority: 3, system: true },
      [
        OKTA,
        'Records',
        ACCESS_POLICY_TYPE_NAME,
        pathNaclCase('my_policy@s'),
        'policyRules',
        pathNaclCase('my_policy__rule'),
      ],
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(custom.elemID, custom)] },
    )

    const elements = [custom, type, ruleType, rule]
    await filter.onFetch(elements)
    const accesPolicies = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
    expect(accesPolicies).toHaveLength(1)
    expect(accesPolicies[0].elemID.name).toEqual('my_policy@s')
    expect(accesPolicies[0].path).toEqual([OKTA, 'Records', 'AccessPolicy', 'my_policy', 'my_policy'])

    const accesRules = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
    expect(accesRules).toHaveLength(1)
    expect(accesRules[0].elemID.name).toEqual('my_policy__rule')
    expect(accesRules[0].annotations[CORE_ANNOTATIONS.PARENT]).toEqual([new ReferenceExpression(custom.elemID, custom)])
  })

  it('should use elem id getter', async () => {
    const custom = new InstanceElement('customized default policy name', type, {
      name: 'customized name',
      system: true,
      type: 'ACCESS_POLICY',
    })

    elemIdGetter.mockReturnValue(new ElemID(OKTA, 'customized name'))

    const elements = [custom, type]
    await filter.onFetch(elements)
    expect(elemIdGetter).toHaveBeenCalledWith(OKTA, expect.any(Object), 'Default_Policy@s')
    const accesPolicies = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
    expect(accesPolicies).toHaveLength(1)
    expect(accesPolicies[0].elemID.name).toEqual('customized name')
  })
  it('should use the default name when elemIdGetter was not passed', async () => {
    filter = renameDefaultAccessPolicy(getFilterParams({})) as typeof filter

    const custom = new InstanceElement('customized default policy name', type, {
      name: 'customized name',
      system: true,
      type: 'ACCESS_POLICY',
    })
    const elements = [custom, type]
    await filter.onFetch(elements)
    const accesPolicies = elements.filter(e => isInstanceElement(e) && e.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
    expect(accesPolicies).toHaveLength(1)
    expect(accesPolicies[0].elemID.name).toEqual('Default_Policy@s')
  })
})
