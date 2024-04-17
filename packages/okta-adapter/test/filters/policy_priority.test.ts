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

import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  isInstanceElement,
  isObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import policyRulePrioritiesFilter from '../../src/filters/policy_priority'
import {
  ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  AUTHORIZATION_POLICY,
  OKTA,
  SIGN_ON_POLICY_PRIORITY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
} from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import { DEFAULT_CONFIG, OktaConfig } from '../../src/config'

const createInstance = (id: number, isSystem: boolean, type: ObjectType, parent?: InstanceElement): InstanceElement =>
  new InstanceElement(
    `accessPolicyRule${id.toString()}`,
    type,
    {
      id,
      system: isSystem,
      name: `accessPolicyRule${id.toString()}`,
      priority: id,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: parent ? [new ReferenceExpression(parent.elemID, parent)] : [],
    },
  )

describe('policyRulePrioritiesFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  let client: OktaClient
  const accessPolicyType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
  const signOnPolicyType = new ObjectType({ elemID: new ElemID(OKTA, SIGN_ON_POLICY_TYPE_NAME) })
  let elements: InstanceElement[]
  const accessPolicyInstance = new InstanceElement(
    'accessPolicyInstance',
    accessPolicyType,
    {
      name: 'accessPolicyInstance',
      id: 4,
    },
    [OKTA, elementUtils.RECORDS_PATH, ACCESS_POLICY_TYPE_NAME, 'accessPolicyInstance', 'accessPolicyInstance'],
  )
  const accessPolicyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const accessPolicyRuleInstanceOne = createInstance(1, false, accessPolicyRuleType, accessPolicyInstance)
  const accessPolicyRuleInstanceTwo = createInstance(2, false, accessPolicyRuleType, accessPolicyInstance)
  const accessPolicyRuleInstanceThree = createInstance(3, false, accessPolicyRuleType, accessPolicyInstance)
  const accessPolicyRuleInstanceFourDefault = createInstance(4, true, accessPolicyRuleType, accessPolicyInstance)
  const signOnPolicyInstanceOne = createInstance(1, false, signOnPolicyType)
  const signOnPolicyInstanceTwo = createInstance(2, false, signOnPolicyType)
  const signOnPolicyInstanceThree = createInstance(3, false, signOnPolicyType)
  const signOnPolicyInstanceFourDefault = createInstance(4, true, signOnPolicyType)
  describe('fetch', () => {
    beforeEach(() => {
      filter = policyRulePrioritiesFilter(getFilterParams({})) as typeof filter
      elements = [
        accessPolicyInstance,
        accessPolicyRuleInstanceOne,
        accessPolicyRuleInstanceTwo,
        accessPolicyRuleInstanceThree,
        accessPolicyRuleInstanceFourDefault,
        signOnPolicyInstanceOne,
        signOnPolicyInstanceTwo,
        signOnPolicyInstanceThree,
        signOnPolicyInstanceFourDefault,
      ]
    })
    it('should add AccessPolicyRulePriority instance and type to the elements', async () => {
      await filter.onFetch(elements)
      const rulePriorityInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(rulePriorityInstances[0]).toBeDefined()
      expect(rulePriorityInstances[0].elemID.name).toEqual('accessPolicyInstance_priority')
      expect(rulePriorityInstances[0].value.priorities).toEqual([
        new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
        new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
        new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
      ])
      expect(rulePriorityInstances[0].value.defaultRule).toEqual(
        new ReferenceExpression(accessPolicyRuleInstanceFourDefault.elemID, accessPolicyRuleInstanceFourDefault),
      )
      const priorityType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityType).toBeDefined()
      expect(rulePriorityInstances[0].path).toEqual([
        OKTA,
        elementUtils.RECORDS_PATH,
        ACCESS_POLICY_TYPE_NAME,
        'accessPolicyInstance',
        'accessPolicyInstance_priority',
      ])
      const policyPriorityInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === SIGN_ON_POLICY_PRIORITY_TYPE_NAME)
      expect(policyPriorityInstances[0]).toBeDefined()
      expect(policyPriorityInstances[0].elemID.name).toEqual('OktaSignOnPolicy_priority')
      expect(policyPriorityInstances[0].value.priorities).toEqual([
        new ReferenceExpression(signOnPolicyInstanceOne.elemID, signOnPolicyInstanceOne),
        new ReferenceExpression(signOnPolicyInstanceTwo.elemID, signOnPolicyInstanceTwo),
        new ReferenceExpression(signOnPolicyInstanceThree.elemID, signOnPolicyInstanceThree),
      ])
      expect(policyPriorityInstances[0].value.defaultPolicy).toEqual(
        new ReferenceExpression(signOnPolicyInstanceFourDefault.elemID, signOnPolicyInstanceFourDefault),
      )
      const policyPriorityType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === SIGN_ON_POLICY_PRIORITY_TYPE_NAME)
      expect(policyPriorityType).toBeDefined()
      expect(policyPriorityInstances[0].path).toEqual([
        OKTA,
        elementUtils.RECORDS_PATH,
        SIGN_ON_POLICY_TYPE_NAME,
        'OktaSignOnPolicy_priority',
      ])
    })
    it("should add AccessPolicyRulePriority instance and type to the elements when it doesn't have default rule", async () => {
      elements = [
        accessPolicyInstance,
        accessPolicyRuleInstanceOne,
        accessPolicyRuleInstanceTwo,
        accessPolicyRuleInstanceThree,
      ]
      await filter.onFetch(elements)
      const priorityInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityInstances[0]).toBeDefined()
      expect(priorityInstances[0].elemID.name).toEqual('accessPolicyInstance_priority')
      expect(priorityInstances[0].value.priorities).toEqual([
        new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
        new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
        new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
      ])
      expect(priorityInstances[0].value.defaultRule).toBeUndefined()
      const priorityType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityType).toBeDefined()
      expect(priorityInstances[0].path).toEqual([
        OKTA,
        elementUtils.RECORDS_PATH,
        ACCESS_POLICY_TYPE_NAME,
        'accessPolicyInstance',
        'accessPolicyInstance_priority',
      ])
    })
    it('should add AccessPolicyRulePriority instance and type to the elements when access policy has no path', async () => {
      accessPolicyInstance.path = undefined
      elements = [
        accessPolicyInstance,
        accessPolicyRuleInstanceOne,
        accessPolicyRuleInstanceTwo,
        accessPolicyRuleInstanceThree,
      ]
      await filter.onFetch(elements)
      const priorityInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityInstances[0]).toBeDefined()
      expect(priorityInstances[0].elemID.name).toEqual('accessPolicyInstance_priority')
      expect(priorityInstances[0].value.priorities).toEqual([
        new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
        new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
        new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
      ])
      expect(priorityInstances[0].value.defaultRule).toBeUndefined()
      const priorityType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityType).toBeDefined()
      expect(priorityInstances[0].path).toEqual(['accessPolicyInstance_priority'])
    })
    it('should not add AccessPolicyRulePriority instance if there is no parent AccessPolicy', async () => {
      const elementsWithoutAccessPolicy = elements.map(instance => {
        const instanceWithoutAccessPolicy = instance.clone()
        instanceWithoutAccessPolicy.annotations[CORE_ANNOTATIONS.PARENT] = undefined
        return instanceWithoutAccessPolicy
      })

      await filter.onFetch(elementsWithoutAccessPolicy)
      const priorityInstances = elementsWithoutAccessPolicy
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME)
      expect(priorityInstances).toHaveLength(0)
    })
  })
  describe('deploy', () => {
    let connection: MockInterface<clientUtils.APIConnection>
    let accessPolicyRulePriorityInstance: InstanceElement
    let oktaSignOnPolicyPriorityInstance: InstanceElement
    const accessPolicyRulePriorityType = new ObjectType({
      elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME),
    })
    const oktaSignOnPolicyPriorityType = new ObjectType({
      elemID: new ElemID(OKTA, SIGN_ON_POLICY_PRIORITY_TYPE_NAME),
    })
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      filter = policyRulePrioritiesFilter(getFilterParams({ client })) as typeof filter
      accessPolicyRulePriorityInstance = new InstanceElement(
        'accessPolicyRulePriorityInstance',
        accessPolicyRulePriorityType,
        {
          priorities: [
            new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
            new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
            new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
          ],
          defaultRule: new ReferenceExpression(
            accessPolicyRuleInstanceFourDefault.elemID,
            accessPolicyRuleInstanceFourDefault,
          ),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(accessPolicyInstance.elemID, accessPolicyInstance)],
        },
      )
      oktaSignOnPolicyPriorityInstance = new InstanceElement(
        'oktaSignOnPolicyPriorityInstance',
        oktaSignOnPolicyPriorityType,
        {
          priorities: [
            new ReferenceExpression(signOnPolicyInstanceOne.elemID, signOnPolicyInstanceOne),
            new ReferenceExpression(signOnPolicyInstanceTwo.elemID, signOnPolicyInstanceTwo),
            new ReferenceExpression(signOnPolicyInstanceThree.elemID, signOnPolicyInstanceThree),
          ],
          defaultPolicy: new ReferenceExpression(
            signOnPolicyInstanceFourDefault.elemID,
            signOnPolicyInstanceFourDefault,
          ),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [],
        },
      )
      connection.put.mockResolvedValue({ status: 200, data: {} })
    })
    it('should apply order when adding accessPolicyRulePriorityInstance', async () => {
      const changes = [toChange({ after: accessPolicyRulePriorityInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(3)
    })
    it('should apply order when adding oktaSignOnPriorityInstance', async () => {
      const changes = [toChange({ after: oktaSignOnPolicyPriorityInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(3)
    })
    it('should apply order when adding AuthorizationServerPolicyRulePriorityInstance', async () => {
      const authorizationServerPolicyType = new ObjectType({ elemID: new ElemID(OKTA, AUTHORIZATION_POLICY) })
      const authorizationServerPolicyInstance = new InstanceElement(
        'authorizationServerPolicyInstance',
        authorizationServerPolicyType,
        {
          name: 'authorizationServerPolicyInstance',
          id: 4,
        },
        [
          OKTA,
          elementUtils.RECORDS_PATH,
          AUTHORIZATION_POLICY,
          'authorizationServerPolicyInstance',
          'authorizationServerPolicyInstance',
        ],
      )
      const authorizationServerPolicyRuleType = new ObjectType({
        elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME),
      })
      const authorizationServerPolicyRuleInstanceOne = createInstance(
        1,
        false,
        authorizationServerPolicyRuleType,
        authorizationServerPolicyInstance,
      )
      const authorizationServerPolicyRuleInstanceTwo = createInstance(
        2,
        false,
        authorizationServerPolicyRuleType,
        authorizationServerPolicyInstance,
      )
      const authorizationServerPolicyRuleInstanceThree = createInstance(
        3,
        false,
        authorizationServerPolicyRuleType,
        authorizationServerPolicyInstance,
      )
      const authorizationServerPolicyRuleInstanceFourDefault = createInstance(
        4,
        true,
        authorizationServerPolicyRuleType,
        authorizationServerPolicyInstance,
      )
      const authorizationServerPolicyRulePriorityType = new ObjectType({
        elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME),
      })
      const authorizationServerPolicyPriorityInstance = new InstanceElement(
        'authorizationServerPolicyPriorityInstance',
        authorizationServerPolicyRulePriorityType,
        {
          priorities: [
            new ReferenceExpression(
              authorizationServerPolicyRuleInstanceOne.elemID,
              authorizationServerPolicyRuleInstanceOne,
            ),
            new ReferenceExpression(
              authorizationServerPolicyRuleInstanceTwo.elemID,
              authorizationServerPolicyRuleInstanceTwo,
            ),
            new ReferenceExpression(
              authorizationServerPolicyRuleInstanceThree.elemID,
              authorizationServerPolicyRuleInstanceThree,
            ),
          ],
          defaultRule: new ReferenceExpression(
            authorizationServerPolicyRuleInstanceFourDefault.elemID,
            authorizationServerPolicyRuleInstanceFourDefault,
          ),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(authorizationServerPolicyInstance.elemID, authorizationServerPolicyInstance),
          ],
        },
      )
      const changes = [toChange({ after: authorizationServerPolicyPriorityInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(3)
    })
    it('should call API only for changed positions when modifing', async () => {
      const accessPolicyRulePriorityInstanceAfter = accessPolicyRulePriorityInstance.clone()
      accessPolicyRulePriorityInstanceAfter.value.priorities = [
        new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
        new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
        new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
      ]
      const changes = [
        toChange({ before: accessPolicyRulePriorityInstance, after: accessPolicyRulePriorityInstanceAfter }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(2)
    })
    it('should change order when adding another rule and change order', async () => {
      const accessPolicyRuleInstanceFive = createInstance(5, false, accessPolicyRuleType, accessPolicyInstance)
      const accessPolicyRulePriorityInstanceAfter = accessPolicyRulePriorityInstance.clone()
      accessPolicyRulePriorityInstanceAfter.value.priorities = [
        new ReferenceExpression(accessPolicyRuleInstanceTwo.elemID, accessPolicyRuleInstanceTwo),
        new ReferenceExpression(accessPolicyRuleInstanceOne.elemID, accessPolicyRuleInstanceOne),
        new ReferenceExpression(accessPolicyRuleInstanceThree.elemID, accessPolicyRuleInstanceThree),
        new ReferenceExpression(accessPolicyRuleInstanceFive.elemID, accessPolicyRuleInstanceFive),
      ]
      const changes = [
        toChange({ before: accessPolicyRulePriorityInstance, after: accessPolicyRulePriorityInstanceAfter }),
      ]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(3)
    })
    it('should throw when deployUrl is not defined', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        apiDefinitions: {
          types: {
            [ACCESS_POLICY_RULE_TYPE_NAME]: {
              deployRequests: {
                modify: {
                  url: undefined,
                },
              },
            },
          },
        },
      } as unknown as OktaConfig
      filter = policyRulePrioritiesFilter(getFilterParams({ client, config })) as typeof filter
      const changes = [toChange({ after: accessPolicyRulePriorityInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual('Failed to deploy priority change due to missing url')
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
    it('should throw when there are no deployRequest', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        apiDefinitions: {
          types: {
            [ACCESS_POLICY_RULE_TYPE_NAME]: {},
          },
        },
      } as unknown as OktaConfig
      filter = policyRulePrioritiesFilter(getFilterParams({ client, config })) as typeof filter
      const changes = [toChange({ after: accessPolicyRulePriorityInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual('Failed to deploy priority change due to missing url')
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
  })
})
