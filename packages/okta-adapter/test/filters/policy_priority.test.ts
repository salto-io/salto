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
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import policyPrioritiesFilter, {
  ALL_SUPPORTED_POLICY_NAMES,
  ALL_SUPPORTED_POLICY_RULE_NAMES,
} from '../../src/filters/policy_priority'
import { OKTA, SIGN_ON_RULE_TYPE_NAME } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import { DEFAULT_CONFIG, OktaConfig } from '../../src/config'

describe('policyPrioritiesFilter', () => {
  const createInstance = (id: number, isSystem: boolean, type: ObjectType, parent?: InstanceElement): InstanceElement =>
    new InstanceElement(
      `accessPolicyRule${id.toString()}`,
      type,
      {
        id,
        system: isSystem,
        name: `accessPolicyRule${id.toString()}`,
        priority: id,
        actions: {
          signon: {
            access: 'ALLOW',
          },
        },
        type: 'someType',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: parent ? [new ReferenceExpression(parent.elemID, parent)] : [],
      },
    )
  const policyRuleTypeNameToPolicyName = (policyRuleName: string): string => {
    const ruleIndex = policyRuleName.indexOf('Rule')
    return policyRuleName.slice(0, ruleIndex)
  }
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  let client: OktaClient
  let elements: InstanceElement[]
  describe('fetch', () => {
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should add rule%sPriority instance and type to the elements',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        elements = [
          policyRuleInstanceOne,
          policyRuleInstanceTwo,
          policyRuleInstanceThree,
          policyRuleInstanceFourDefault,
        ]
        await filter.onFetch(elements)
        const priorityInstances = elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === `${policyRuleName}Priority`)
        expect(priorityInstances[0]).toBeDefined()
        expect(priorityInstances[0].elemID.name).toEqual(`${policyRuleName}Instance_priority`)
        expect(priorityInstances[0].value.priorities).toEqual([
          new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
          new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
          new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
        ])
        expect(priorityInstances[0].value.defaultRule).toEqual(
          new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
        )
      },
    )
    it.each(ALL_SUPPORTED_POLICY_NAMES)(
      'should add %sPriority instance and type to the elements',
      async (policyName: string) => {
        filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
        const policyInstanceOne = createInstance(1, false, policyType)
        const policyInstanceTwo = createInstance(2, false, policyType)
        const policyInstanceThree = createInstance(3, false, policyType)
        const policyInstanceFourDefault = createInstance(4, true, policyType)
        elements = [policyInstanceOne, policyInstanceTwo, policyInstanceThree, policyInstanceFourDefault]
        await filter.onFetch(elements)
        const priorityInstances = elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === `${policyName}Priority`)
        expect(priorityInstances[0]).toBeDefined()
        expect(priorityInstances[0].elemID.name).toEqual(`${policyName}_priority`)
        expect(priorityInstances[0].value.priorities).toEqual([
          new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
          new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
          new ReferenceExpression(policyInstanceThree.elemID, policyInstanceThree),
        ])
        expect(priorityInstances[0].value.defaultPolicy).toEqual(
          new ReferenceExpression(policyInstanceFourDefault.elemID, policyInstanceFourDefault),
        )
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should add rule%sPriority instance and type to the elements when it does not have default rule',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        elements = [policyRuleInstanceOne, policyRuleInstanceTwo, policyRuleInstanceThree]
        await filter.onFetch(elements)
        const priorityInstances = elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === `${policyRuleName}Priority`)
        expect(priorityInstances[0]).toBeDefined()
        expect(priorityInstances[0].elemID.name).toEqual(`${policyRuleName}Instance_priority`)
        expect(priorityInstances[0].value.priorities).toEqual([
          new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
          new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
          new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
        ])
        expect(priorityInstances[0].value.defaultRule).toBeUndefined()
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should add rule%sPriority instance and type to the elements when policy has no path',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(`${policyRuleName}Instance`, policyType, {
          name: `${policyRuleName}Instance`,
          id: 4,
        })
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        elements = [policyRuleInstanceOne, policyRuleInstanceTwo, policyRuleInstanceThree]
        await filter.onFetch(elements)
        const priorityInstances = elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === `${policyRuleName}Priority`)
        expect(priorityInstances[0]).toBeDefined()
        expect(priorityInstances[0].elemID.name).toEqual(`${policyRuleName}Instance_priority`)
        expect(priorityInstances[0].value.priorities).toEqual([
          new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
          new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
          new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
        ])
        expect(priorityInstances[0].value.defaultRule).toBeUndefined()
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should not add rule%sPriority instance if there is no parent policy',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType)
        elements = [policyRuleInstanceOne, policyRuleInstanceTwo, policyRuleInstanceThree]
        await filter.onFetch(elements)
        const priorityInstances = elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === `${policyRuleName}Priority`)
        expect(priorityInstances).toHaveLength(0)
      },
    )
  })
  describe('deploy', () => {
    let connection: MockInterface<clientUtils.APIConnection>
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      filter = policyPrioritiesFilter(getFilterParams({ client })) as typeof filter
      connection.put.mockResolvedValue({ status: 200, data: {} })
    })
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should apply order when adding rule%sPriority instance',
      async (policyRuleName: string) => {
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyRuleName}Priority`) })
        const policyRulePriorityInstance = new InstanceElement(
          `${policyRuleName}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [
              new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
              new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
              new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
            ],
            defaultRule: new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policyInstance.elemID, policyInstance)],
          },
        )
        const changes = [toChange({ after: policyRulePriorityInstance })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledTimes(3)
        if (policyRuleName === SIGN_ON_RULE_TYPE_NAME) {
          expect(connection.put).toHaveBeenCalledWith(
            '/api/v1/policies/4/rules/1',
            {
              priority: 1,
              actions: {
                signon: {
                  access: 'ALLOW',
                },
              },
              name: 'accessPolicyRule1',
              type: 'someType',
            },
            undefined,
          )
        }
      },
    )
    it.each(ALL_SUPPORTED_POLICY_NAMES)(
      'should apply order when adding %sPriority instance',
      async (policyName: string) => {
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
        const policyInstanceOne = createInstance(1, false, policyType)
        const policyInstanceTwo = createInstance(2, false, policyType)
        const policyInstanceThree = createInstance(3, false, policyType)
        const policyInstanceFourDefault = createInstance(4, true, policyType)
        const policyPriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
        const policyPriorityInstance = new InstanceElement(
          `${policyName}PriorityInstance`,
          policyPriorityType,
          {
            priorities: [
              new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
              new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
              new ReferenceExpression(policyInstanceThree.elemID, policyInstanceThree),
            ],
            defaultPolicy: new ReferenceExpression(policyInstanceFourDefault.elemID, policyInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [],
          },
        )
        const changes = [toChange({ after: policyPriorityInstance })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledTimes(3)
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should call API only for changed positions when modifing rule%sPriority instance',
      async (policyRuleName: string) => {
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyRuleName}Priority`) })
        const policyRulePriorityInstance = new InstanceElement(
          `${policyRuleName}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [
              new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
              new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
              new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
            ],
            defaultRule: new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policyInstance.elemID, policyInstance)],
          },
        )
        const policyRulePriorityInstanceAfter = policyRulePriorityInstance.clone()
        policyRulePriorityInstanceAfter.value.priorities = [
          new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
          new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
          new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
        ]
        const changes = [toChange({ before: policyRulePriorityInstance, after: policyRulePriorityInstanceAfter })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledTimes(2)
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should change order when adding another rule and change order for rule%sPriority instance',
      async (policyRuleName: string) => {
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyRuleName}Priority`) })
        const policyRulePriorityInstance = new InstanceElement(
          `${policyRuleName}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [
              new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
              new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
              new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
            ],
            defaultRule: new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policyInstance.elemID, policyInstance)],
          },
        )
        const policyRuleInstanceFive = createInstance(5, false, policyRuleType, policyInstance)
        const policyRulePriorityInstanceAfter = policyRulePriorityInstance.clone()
        policyRulePriorityInstanceAfter.value.priorities = [
          new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
          new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
          new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
          new ReferenceExpression(policyRuleInstanceFive.elemID, policyRuleInstanceFive),
        ]
        const changes = [toChange({ before: policyRulePriorityInstance, after: policyRulePriorityInstanceAfter })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledTimes(3)
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should throw when deployUrl is not defined for rule%sPriority instance',
      async (policyRuleName: string) => {
        const config = {
          ...DEFAULT_CONFIG,
          apiDefinitions: {
            types: {
              [policyRuleName]: {
                deployRequests: {
                  modify: {
                    url: undefined,
                  },
                },
              },
            },
          },
        } as unknown as OktaConfig
        filter = policyPrioritiesFilter(getFilterParams({ client, config })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyRuleName}Priority`) })
        const policyRulePriorityInstance = new InstanceElement(
          `${policyRuleName}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [
              new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
              new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
              new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
            ],
            defaultRule: new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policyInstance.elemID, policyInstance)],
          },
        )
        const changes = [toChange({ after: policyRulePriorityInstance })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].message).toEqual('Failed to deploy priority change due to missing url')
        expect(res.deployResult.appliedChanges).toHaveLength(0)
        expect(connection.put).toHaveBeenCalledTimes(0)
      },
    )
    it.each(ALL_SUPPORTED_POLICY_RULE_NAMES)(
      'should throw when deployRequests is not defined for rule%sPriority instance',
      async (policyRuleName: string) => {
        const config = {
          ...DEFAULT_CONFIG,
          apiDefinitions: {
            types: {
              [policyRuleName]: {
                deployRequests: undefined,
              },
            },
          },
        } as unknown as OktaConfig
        filter = policyPrioritiesFilter(getFilterParams({ client, config })) as typeof filter
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(
          `${policyRuleName}Instance`,
          policyType,
          {
            name: `${policyRuleName}Instance`,
            id: 4,
          },
          [
            OKTA,
            elementUtils.RECORDS_PATH,
            policyRuleTypeNameToPolicyName(policyRuleName),
            `${policyRuleName}_instance`,
            `${policyRuleName}_instance`,
          ],
        )
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceTwo = createInstance(2, false, policyRuleType, policyInstance)
        const policyRuleInstanceThree = createInstance(3, false, policyRuleType, policyInstance)
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyRuleName}Priority`) })
        const policyRulePriorityInstance = new InstanceElement(
          `${policyRuleName}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [
              new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne),
              new ReferenceExpression(policyRuleInstanceTwo.elemID, policyRuleInstanceTwo),
              new ReferenceExpression(policyRuleInstanceThree.elemID, policyRuleInstanceThree),
            ],
            defaultRule: new ReferenceExpression(policyRuleInstanceFourDefault.elemID, policyRuleInstanceFourDefault),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policyInstance.elemID, policyInstance)],
          },
        )
        const changes = [toChange({ after: policyRulePriorityInstance })]
        const res = await filter.deploy(changes)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].message).toEqual('Failed to deploy priority change due to missing url')
        expect(res.deployResult.appliedChanges).toHaveLength(0)
        expect(connection.put).toHaveBeenCalledTimes(0)
      },
    )
  })
})
