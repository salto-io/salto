/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  filterUtils,
  elements as elementUtils,
  client as clientUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
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
  POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE,
} from '../../src/filters/policy_priority'
import { ACCESS_POLICY_RULE_TYPE_NAME, ACCESS_POLICY_TYPE_NAME, OKTA } from '../../src/constants'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import { OktaOptions } from '../../src/definitions/types'

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
    beforeEach(() => {
      jest.clearAllMocks()
    })
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should add rule%sPriority instance and type to the elements',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should add rule%sPriority instance and type to the elements when it does not have default rule',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should add rule%sPriority instance and type to the elements when policy has no path',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should not add rule%sPriority instance if there is no parent policy',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should log an error when there are duplicate priorities in %sPriority instance',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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
        policyRuleInstanceThree.value.priority = 2
        const policyRuleInstanceFourDefault = createInstance(4, true, policyRuleType, policyInstance)
        elements = [
          policyRuleInstanceOne,
          policyRuleInstanceTwo,
          policyRuleInstanceThree,
          policyRuleInstanceFourDefault,
        ]

        const logging = logger('okta-adapter/src/filters/policy_priority')
        const logErrorSpy = jest.spyOn(logging, 'error')
        await filter.onFetch(elements)
        expect(logErrorSpy).toHaveBeenCalledWith(
          `Duplicate priorities found for ${policyRuleInstanceTwo.elemID.getFullName()},${policyRuleInstanceThree.elemID.getFullName()} with priority 2`,
        )
      },
    )
    it.each(ALL_SUPPORTED_POLICY_NAMES)(
      'should log an error when there are duplicate priorities in %sPriority instance',
      async (policyName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
        const policyInstanceOne = createInstance(1, false, policyType)
        const policyInstanceTwo = createInstance(2, false, policyType)
        const policyInstanceThree = createInstance(3, false, policyType)
        policyInstanceThree.value.priority = 2
        const policyInstanceFourDefault = createInstance(4, true, policyType)
        elements = [policyInstanceOne, policyInstanceTwo, policyInstanceThree, policyInstanceFourDefault]

        const logging = logger('okta-adapter/src/filters/policy_priority')
        const logErrorSpy = jest.spyOn(logging, 'error')
        await filter.onFetch(elements)
        expect(logErrorSpy).toHaveBeenCalledWith(
          `Duplicate priorities found for ${policyInstanceTwo.elemID.getFullName()},${policyInstanceThree.elemID.getFullName()} with priority 2`,
        )
      },
    )
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should not log an error when there are no duplicate priorities in %sPriority instance',
      async (policyRuleName: string) => {
        filter = policyPrioritiesFilter(getFilterParams()) as typeof filter
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

        const logging = logger('okta-adapter/src/filters/policy_priority')
        const logErrorSpy = jest.spyOn(logging, 'error')
        await filter.onFetch(elements)
        expect(logErrorSpy).not.toHaveBeenCalled()
      },
    )
  })
  describe('deploy', () => {
    let connection: MockInterface<clientUtils.APIConnection>
    let definitions: definitionsUtils.RequiredDefinitions<OktaOptions>
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      definitions = createDefinitions({ client })
      filter = policyPrioritiesFilter(getFilterParams({ definitions })) as typeof filter
      connection.put.mockResolvedValue({ status: 200, data: {} })
      connection.get.mockImplementation(async (url: string) => {
        if (url.includes('rules')) {
          return {
            status: 200,
            data: {
              created: '2021-09-01T00:00:00.000Z',
              settings: {
                a: 'a',
              },
              type: 'someType',
            },
          }
        }
        return {
          status: 200,
          data: {
            created: '2021-09-01T00:00:00.000Z',
            conditions: {
              a: 'a',
            },
            type: 'someType',
          },
        }
      })
    })
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
      'should apply order when adding %sPriority instance',
      async (policyRuleName: string) => {
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
        const policyInstance = new InstanceElement(`${policyRuleName}Instance`, policyType, {
          name: `${policyRuleName}Instance`,
          id: 4,
        })
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

        expect(connection.get).toHaveBeenCalledTimes(3)
        expect(connection.put).toHaveBeenCalledTimes(3)
        const priorities = policyRulePriorityInstance.value.priorities as ReferenceExpression[]
        priorities.forEach((ref, index) => {
          expect(connection.put).toHaveBeenCalledWith(
            `/api/v1/policies/4/rules/${index + 1}`,
            {
              // access policy rule priority starts from 0
              priority: ref.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME ? index : index + 1,
              settings: { a: 'a' },
              type: 'someType',
            },
            undefined,
          )
        })
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

        expect(connection.get).toHaveBeenCalledTimes(3)
        expect(connection.put).toHaveBeenCalledTimes(3)
        const priorities = policyPriorityInstance.value.priorities as ReferenceExpression[]
        priorities.forEach((_, index) => {
          expect(connection.put).toHaveBeenCalledWith(
            `/api/v1/policies/${index + 1}`,
            {
              priority: index + 1,
              conditions: { a: 'a' },
              type: 'someType',
            },
            undefined,
          )
        })
      },
    )
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
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
    it.each(POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE)(
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
    describe('failure scenarios', () => {
      beforeEach(() => {
        jest.clearAllMocks()
        connection.get.mockResolvedValueOnce({ status: 404, data: {} })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            created: '2021-09-01T00:00:00.000Z',
            settings: {
              a: 'a',
            },
            type: 'someType',
          },
        })
        connection.put.mockResolvedValue({ status: 200, data: {} })
      })

      it('should use polling if the GET request returns 404', async () => {
        const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
        const policyType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
        const policyInstance = new InstanceElement(`${ACCESS_POLICY_RULE_TYPE_NAME}Instance`, policyType, {
          name: `${ACCESS_POLICY_RULE_TYPE_NAME}Instance`,
          id: 4,
        })
        const policyRuleInstanceOne = createInstance(1, false, policyRuleType, policyInstance)
        const policyRuleInstanceDefault = createInstance(4, true, policyRuleType, policyInstance)
        const policyRulePriorityType = new ObjectType({
          elemID: new ElemID(OKTA, `${ACCESS_POLICY_RULE_TYPE_NAME}Priority`),
        })
        const policyRulePriorityInstance = new InstanceElement(
          `${ACCESS_POLICY_RULE_TYPE_NAME}PriorityInstance`,
          policyRulePriorityType,
          {
            priorities: [new ReferenceExpression(policyRuleInstanceOne.elemID, policyRuleInstanceOne)],
            defaultRule: new ReferenceExpression(policyRuleInstanceDefault.elemID, policyRuleInstanceDefault),
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

        expect(connection.get).toHaveBeenCalledTimes(2)
        expect(connection.put).toHaveBeenCalledTimes(1)
      })
    })
  })
})
