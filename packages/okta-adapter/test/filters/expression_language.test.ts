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
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  isInstanceElement,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import { FETCH_CONFIG } from '../../src/config'
import { DEFAULT_CONFIG } from '../../src/user_config'
import { getFilterParams } from '../utils'
import oktaExpressionLanguageFilter, {
  getUserSchemaReference,
  resolveUserSchemaRef,
} from '../../src/filters/expression_language'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  OKTA,
  USER_SCHEMA_TYPE_NAME,
} from '../../src/constants'

describe('expression language filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'deploy' | 'preDeploy'>
  let filter: FilterType
  const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const behaviorType = new ObjectType({ elemID: new ElemID(OKTA, BEHAVIOR_RULE_TYPE_NAME) })
  const customPath = ['definitions', 'custom', 'properties', 'saltoDepartment']
  const basePath = ['definitions', 'base', 'properties', 'department']
  const groupRuleWithExpression = new InstanceElement('groupRuleTest', groupRuleType, {
    conditions: {
      expression: {
        value:
          '(String.stringContains(user.department, "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup("00g11111111") AND !isMemberOfAnyGroup("00g22222222", "00g33333333")',
      },
    },
  })
  const groupInstances = [
    new InstanceElement('group1', groupType, { id: '00g11111111' }),
    new InstanceElement('group2', groupType, { id: '00g22222222' }),
    new InstanceElement('group3', groupType, { id: '00g33333333' }),
  ]
  const userSchemaInstance = new InstanceElement('user', userSchemaType, {
    name: 'user',
    definitions: {
      custom: {
        properties: {
          saltoDepartment: {
            title: 'salto',
            type: 'string',
          },
        },
      },
      base: {
        properties: {
          department: {
            title: 'Department',
            type: 'string',
          },
        },
      },
    },
  })
  const behaviorInstance = new InstanceElement('behaviorRule', behaviorType, {
    name: 'New IP',
    type: 'ANOMALOUS_LOCATION',
  })
  const policyRuleWithExpression = new InstanceElement('policyRuleTest', policyRuleType, {
    name: 'policy',
    conditions: {
      elCondition: {
        condition:
          "user.profile.saltoDepartment == 'salto' AND user.isMemberOf({'group.id':{\"00g33333333\", '00g11111111'}}) AND security.behaviors.contains(\"New IP\")",
      },
    },
  })
  const groupRuleWithMissingId = new InstanceElement('groupRuleWithMissingId', groupRuleType, {
    conditions: {
      expression: {
        value: 'isMemberOfAnyGroup("00g11111111", "00g5555555555")',
      },
    },
  })
  const userSchemaBaseAttRef = new ReferenceExpression(
    userSchemaInstance.elemID.createNestedID(...basePath),
    _.get(userSchemaInstance.value, basePath),
  )
  const userSchemaCustomAttRef = new ReferenceExpression(
    userSchemaInstance.elemID.createNestedID(...customPath),
    _.get(userSchemaInstance.value, customPath),
  )
  const groupRuleTemplate = new TemplateExpression({
    parts: [
      '(String.stringContains(',
      userSchemaBaseAttRef,
      ', "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup(',
      new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
      ') AND !isMemberOfAnyGroup(',
      new ReferenceExpression(groupInstances[1].elemID, groupInstances[1]),
      ', ',
      new ReferenceExpression(groupInstances[2].elemID, groupInstances[2]),
      ')',
    ],
  })
  const policyRuleTemplate = new TemplateExpression({
    parts: [
      userSchemaCustomAttRef,
      " == 'salto' AND user.isMemberOf({'group.id':{",
      new ReferenceExpression(groupInstances[2].elemID, groupInstances[2]),
      ', ',
      new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
      '}}) AND security.behaviors.contains(',
      new ReferenceExpression(behaviorInstance.elemID, behaviorInstance),
      ')',
    ],
  })

  beforeEach(() => {
    filter = oktaExpressionLanguageFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should resolve templates in instances', async () => {
      const elements = [
        userSchemaType,
        groupType,
        groupRuleType,
        policyRuleWithExpression,
        policyRuleType,
        groupRuleWithExpression,
        ...groupInstances,
        userSchemaInstance,
        behaviorInstance,
      ]
      await filter.onFetch(elements)
      const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleTest')
      expect(groupRule).toBeDefined()
      expect(groupRule?.value?.conditions?.expression?.value).toEqual(groupRuleTemplate)
      const policyRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'policyRuleTest')
      expect(policyRule).toBeDefined()
      expect(policyRule?.value?.conditions?.elCondition?.condition).toEqual(policyRuleTemplate)
    })

    it('should create missing reference if there is no match and the id is in groupId format and enableMissingReferences flag enabled', async () => {
      const elements = [groupRuleType, groupType, groupRuleWithMissingId.clone(), ...groupInstances]
      await filter.onFetch(elements)
      const missingInstance = referencesUtils.createMissingInstance(OKTA, GROUP_TYPE_NAME, '00g5555555555')
      const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleWithMissingId')
      expect(groupRule).toBeDefined()
      expect(groupRule?.value?.conditions?.expression?.value).toEqual(
        new TemplateExpression({
          parts: [
            'isMemberOfAnyGroup(',
            new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
            ', ',
            new ReferenceExpression(missingInstance.elemID, missingInstance),
            ')',
          ],
        }),
      )
    })

    it('should not create missing reference if enableMissingReferences flag disabled', async () => {
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].enableMissingReferences = false
      const missingRefFilter = oktaExpressionLanguageFilter(getFilterParams({ config })) as typeof filter
      const elements = [groupRuleType, groupType, groupRuleWithMissingId.clone(), ...groupInstances]
      await missingRefFilter.onFetch(elements)
      const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleWithMissingId')
      expect(groupRule).toBeDefined()
      expect(groupRule?.value?.conditions?.expression?.value).toEqual(
        new TemplateExpression({
          parts: [
            'isMemberOfAnyGroup(',
            new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
            ', "00g5555555555")',
          ],
        }),
      )
    })

    it('should not create template expression if no references were found', async () => {
      const groupRuleNoReferences = new InstanceElement('groupRuleNoReferences', groupRuleType, {
        conditions: {
          expression: {
            value: 'isMemberOfGroupNameRegex("/.*admin.*")',
          },
        },
      })
      const elements = [groupRuleType, groupType, groupRuleNoReferences]
      await filter.onFetch(elements)
      const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleNoReferences')
      expect(groupRule).toBeDefined()
      expect(groupRule?.value?.conditions?.expression?.value).toEqual('isMemberOfGroupNameRegex("/.*admin.*")')
    })

    it('should not create template expression if expression path does not exist', async () => {
      const groupRuleWithNoExpression = new InstanceElement('groupRuleNoExpression', groupRuleType, {
        conditions: {
          people: { users: { exclude: ['123', '234'] } },
        },
      })
      const elements = [groupRuleType, groupType, groupRuleWithNoExpression]
      await filter.onFetch(elements)
      const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleNoExpression')
      expect(groupRule).toBeDefined()
      expect(groupRule?.value).toEqual({
        conditions: {
          people: { users: { exclude: ['123', '234'] } },
        },
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    const groupRuleWithTemplate = new InstanceElement('groupRuleTest', groupRuleType, {
      conditions: { expression: { value: groupRuleTemplate } },
    })
    const policyRuleWithTemplate = new InstanceElement('policyRuleTest', policyRuleType, {
      conditions: {
        elCondition: {
          condition: policyRuleTemplate,
        },
      },
    })

    describe('preDeploy', () => {
      it('should replace template expressions with strings', async () => {
        const changes = [
          toChange({ after: groupRuleWithTemplate.clone() }),
          toChange({ after: policyRuleWithTemplate.clone() }),
        ]
        await filter.preDeploy(changes)
        const instances = changes.map(getChangeData).filter(isInstanceElement)
        const groupRuleInstance = instances.find(i => i.elemID.name === 'groupRuleTest')
        expect(groupRuleInstance).toBeDefined()
        expect(groupRuleInstance?.value?.conditions?.expression?.value).toEqual(
          '(String.stringContains(user.department, "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup("00g11111111") AND !isMemberOfAnyGroup("00g22222222", "00g33333333")',
        )
        const policyRuleInstance = instances.find(i => i.elemID.name === 'policyRuleTest')
        expect(policyRuleInstance).toBeDefined()
        expect(policyRuleInstance?.value?.conditions?.elCondition?.condition).toEqual(
          'user.profile.saltoDepartment == \'salto\' AND user.isMemberOf({\'group.id\':{"00g33333333", "00g11111111"}}) AND security.behaviors.contains("New IP")',
        )
      })
    })
    describe('onDeploy', () => {
      it('should restore template expressions using the mapping', async () => {
        const changes = [
          toChange({ after: groupRuleWithTemplate.clone() }),
          toChange({ after: policyRuleWithTemplate.clone() }),
        ]
        // call preDeploy to set the mapping
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        const instances = changes.map(getChangeData).filter(isInstanceElement)
        const groupRuleInstance = instances.find(i => i.elemID.name === 'groupRuleTest')
        expect(groupRuleInstance).toBeDefined()
        expect(groupRuleInstance?.value?.conditions?.expression?.value).toEqual(groupRuleTemplate)
        const policyRuleInstance = instances.find(i => i.elemID.name === 'policyRuleTest')
        expect(policyRuleInstance).toBeDefined()
        expect(policyRuleInstance?.value?.conditions?.elCondition?.condition).toEqual(policyRuleTemplate)
      })
    })
  })

  describe('deploy', () => {
    const groupRuleWithTemplate = new InstanceElement('groupRuleTest', groupRuleType, {
      conditions: { expression: { value: groupRuleTemplate } },
    })
    const groupWithoutId = groupInstances[0].clone()
    delete groupWithoutId.value.id
    const groupRuleInvalidTemplate = new InstanceElement('groupRuleTest2', groupRuleType, {
      conditions: {
        expression: {
          value: new TemplateExpression({
            parts: [new ReferenceExpression(groupWithoutId.elemID, groupWithoutId), " == 'salto'"],
          }),
        },
      },
    })
    it('should return error for changes with template expression we could not resolve', async () => {
      const changes = [
        toChange({ after: groupRuleWithTemplate.clone() }),
        toChange({ after: groupRuleInvalidTemplate.clone() }),
      ]
      // call preDeploy to set the mapping
      await filter.preDeploy(changes)
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges.length).toEqual(1)
      expect(res.deployResult.errors.length).toEqual(1)
      expect(res.deployResult.errors[0]).toEqual({
        severity: 'Error',
        message: 'Error parsing Okta expression language expression',
        elemID: groupRuleInvalidTemplate.elemID,
      })
    })
  })

  describe('getUserSchemaReference', () => {
    it('it should return reference to custom path if attribute is custom', () => {
      const res = getUserSchemaReference('saltoDepartment', userSchemaInstance)
      expect(res).toBeInstanceOf(ReferenceExpression)
      expect(res?.elemID.getFullName()).toEqual(
        'okta.UserSchema.instance.user.definitions.custom.properties.saltoDepartment',
      )
    })
    it('it should return reference to base path if attribute is basic', () => {
      const res = getUserSchemaReference('department', userSchemaInstance)
      expect(res).toBeInstanceOf(ReferenceExpression)
      expect(res?.elemID.getFullName()).toEqual('okta.UserSchema.instance.user.definitions.base.properties.department')
    })
    it('it should return undefined if attribute is missing', () => {
      const res = getUserSchemaReference('something', userSchemaInstance)
      expect(res).toBeUndefined()
    })
  })

  describe('resolveUserSchemaRef', () => {
    it('should return attribute name for reference', () => {
      const resCustom = resolveUserSchemaRef(userSchemaCustomAttRef)
      expect(resCustom).toEqual('saltoDepartment')
      const resBase = resolveUserSchemaRef(userSchemaBaseAttRef)
      expect(resBase).toEqual('department')
    })
    it('should return undefined for invalid reference ', () => {
      const ref = new ReferenceExpression(userSchemaInstance.elemID, userSchemaInstance)
      const res = resolveUserSchemaRef(ref)
      expect(res).toBeUndefined()
    })
  })
})
