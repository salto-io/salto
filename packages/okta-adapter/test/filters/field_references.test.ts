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
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
  ListType,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import {
  APPLICATION_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  OKTA,
  USERTYPE_TYPE_NAME,
} from '../../src/constants'
import { getFilterParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

describe('fieldReferencesFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>

  const profileMappingSource = new ObjectType({
    elemID: new ElemID(OKTA, 'ProfileMappingSource'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      type: { refType: BuiltinTypes.STRING },
    },
  })
  const profileMappingType = new ObjectType({
    elemID: new ElemID(OKTA, 'ProfileMapping'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      source: { refType: profileMappingSource },
      target: { refType: profileMappingSource },
    },
  })
  const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const groupRuleAssign = new ObjectType({
    elemID: new ElemID(OKTA, 'GroupRuleGroupAssignment'),
    fields: {
      groupIds: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })
  const ruleType = new ObjectType({
    elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME),
    fields: {
      assignUserToGroups: { refType: groupRuleAssign },
    },
  })
  const generateElements = (): Element[] => [
    profileMappingType,
    userTypeType,
    appType,
    profileMappingSource,
    groupType,
    ruleType,
    new InstanceElement('mapping1', profileMappingType, {
      source: { id: '111', type: 'user' },
      target: { id: '222', type: 'appuser' },
    }),
    new InstanceElement('app1', appType, { id: '222' }),
    new InstanceElement('userType1', userTypeType, { id: '111' }),
    new InstanceElement('rule', ruleType, { id: '111', assignUserToGroups: { groupIds: ['missingId'] } }),
  ]

  describe('onFetch', () => {
    it('should resolve field values when referenced element exists', async () => {
      const elements = generateElements().map(e => e.clone())
      const filter = filterCreator(getFilterParams({})) as FilterType
      await filter.onFetch(elements)
      const mapping1 = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'mapping1')[0] as InstanceElement
      expect(mapping1.value.source.id).toBeInstanceOf(ReferenceExpression)
      expect(mapping1.value.source.id.elemID.getFullName()).toEqual('okta.UserType.instance.userType1')
      expect(mapping1.value.target.id).toBeInstanceOf(ReferenceExpression)
      expect(mapping1.value.target.id.elemID.getFullName()).toEqual('okta.Application.instance.app1')
    })
    it('should create missing references if enableMissingReferences flag is enabled', async () => {
      const elements = generateElements().map(e => e.clone())
      const configWithMissingRefs = { ...DEFAULT_CONFIG }
      configWithMissingRefs[FETCH_CONFIG].enableMissingReferences = true
      const filter = filterCreator(getFilterParams({ config: configWithMissingRefs })) as FilterType
      await filter.onFetch(elements)
      const rule = elements.filter(
        e => isInstanceElement(e) && e.elemID.typeName === GROUP_RULE_TYPE_NAME,
      )[0] as InstanceElement
      expect(rule.value?.assignUserToGroups?.groupIds[0]).toBeInstanceOf(ReferenceExpression)
      expect(rule.value?.assignUserToGroups?.groupIds[0].elemID.getFullName()).toEqual(
        'okta.Group.instance.missing_missingId',
      )
    })
    it('should not create missing references if enableMissingReferences flag is disabled', async () => {
      const elements = generateElements().map(e => e.clone())
      const configWithNoMissingRefs = { ...DEFAULT_CONFIG }
      configWithNoMissingRefs[FETCH_CONFIG].enableMissingReferences = false
      const filter = filterCreator(getFilterParams({ config: configWithNoMissingRefs })) as FilterType
      await filter.onFetch(elements)
      const rule = elements.filter(
        e => isInstanceElement(e) && e.elemID.typeName === GROUP_RULE_TYPE_NAME,
      )[0] as InstanceElement
      expect(rule.value?.assignUserToGroups?.groupIds).toEqual(['missingId'])
    })
  })
})
