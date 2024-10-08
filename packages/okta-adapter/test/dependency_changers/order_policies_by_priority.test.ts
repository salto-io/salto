/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  InstanceElement,
  toChange,
  DependencyChange,
  ElemID,
  ObjectType,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { OKTA } from '../../src/constants'
import { changeDependenciesFromPoliciesAndRulesToPriority } from '../../src/dependency_changers/policy_and_rules_to_priority'
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_WITH_PRIORITY } from '../../src/filters/policy_priority'
import { addDependenciesFromPolicyToPriorPolicy } from '../../src/dependency_changers/order_policies_by_priority'
import { policyRuleTypeNameToPolicyName } from '../filters/policy_priority.test'

const createPolicyOrRuleInstance = (
  policyName: string,
  name: string,
  id: number,
  isDefault?: boolean,
): InstanceElement => {
  const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
  const parentType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyName)) })
  const parentOne = new InstanceElement('parentOne', parentType, {
    id: '1',
    name: 'parentOne',
  })
  return new InstanceElement(
    name,
    policyType,
    {
      id,
      name,
      system: isDefault,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: ALL_SUPPORTED_POLICY_NAMES.includes(policyName)
        ? undefined
        : [new ReferenceExpression(parentOne.elemID, parentOne)],
    },
  )
}

describe('addDependenciesFromPolicyToPriorPolicy', () => {
  let dependencyChanges: DependencyChange[]
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should add dependencies between each %s addition change when their priority is also addition change',
    async (policyName: string) => {
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceOne = createPolicyOrRuleInstance(policyName, 'policyInstanceOne', 1)
      const policyInstanceTwo = createPolicyOrRuleInstance(policyName, 'policyInstanceTwo', 2)
      const policyInstanceThree = createPolicyOrRuleInstance(policyName, 'policyInstanceThree', 3)
      const defaultPolicyInstance = createPolicyOrRuleInstance(policyName, 'defaultPolicyInstance', 0, true)
      const priorityInstance = new InstanceElement('priorityInstance', priorityType, {
        priorities: [
          new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
          new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
          new ReferenceExpression(policyInstanceThree.elemID, policyInstanceThree),
        ],
        defaultRule: ALL_SUPPORTED_POLICY_NAMES.includes(policyName)
          ? undefined
          : new ReferenceExpression(defaultPolicyInstance.elemID, defaultPolicyInstance),
        defaultPolicy: ALL_SUPPORTED_POLICY_NAMES.includes(policyName)
          ? new ReferenceExpression(defaultPolicyInstance.elemID, defaultPolicyInstance)
          : undefined,
      })

      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceOne })],
        [1, toChange({ after: policyInstanceTwo })],
        [2, toChange({ after: policyInstanceThree })],
        [3, toChange({ after: priorityInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await addDependenciesFromPolicyToPriorPolicy(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(1)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
      expect(dependencyChanges[1].action).toEqual('add')
      expect(dependencyChanges[1].dependency.source).toEqual(2)
      expect(dependencyChanges[1].dependency.target).toEqual(1)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should add dependencies between each %s addition change when their priority is modification change',
    async (policyName: string) => {
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceOne = createPolicyOrRuleInstance(policyName, 'policyInstanceOne', 1)
      const policyInstanceTwo = createPolicyOrRuleInstance(policyName, 'policyInstanceTwo', 2)
      const policyInstanceThree = createPolicyOrRuleInstance(policyName, 'policyInstanceThree', 3)
      const priorityInstanceBefore = new InstanceElement('priorityInstance', priorityType, {
        priorities: [new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne)],
      })
      const priorityInstanceAfter = new InstanceElement('priorityInstance', priorityType, {
        priorities: [
          new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
          new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
          new ReferenceExpression(policyInstanceThree.elemID, policyInstanceThree),
        ],
      })

      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceTwo })],
        [1, toChange({ after: policyInstanceThree })],
        [2, toChange({ before: priorityInstanceBefore, after: priorityInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await addDependenciesFromPolicyToPriorPolicy(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(1)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    "should add dependencies between each %s addition change when they don't have priority change",
    async (policyName: string) => {
      const policyInstanceOne = createPolicyOrRuleInstance(policyName, 'policyInstanceOne', 1)
      const policyInstanceTwo = createPolicyOrRuleInstance(policyName, 'policyInstanceTwo', 2)
      const policyInstanceThree = createPolicyOrRuleInstance(policyName, 'policyInstanceThree', 3)

      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceOne })],
        [1, toChange({ after: policyInstanceTwo })],
        [2, toChange({ after: policyInstanceThree })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await addDependenciesFromPolicyToPriorPolicy(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(1)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
      expect(dependencyChanges[1].action).toEqual('add')
      expect(dependencyChanges[1].dependency.source).toEqual(2)
      expect(dependencyChanges[1].dependency.target).toEqual(1)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should not add dependencies between each %s changes when they are modification changes',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const policyInstanceBefore = createPolicyOrRuleInstance(policyName, 'policyInstance', 1)
      const anotherPolicyInstanceBefore = new InstanceElement('anotherPolicyInstance', policyType, {
        id: '2',
        name: 'anotherPolicyInstance',
      })
      const policyInstanceAfter = policyInstanceBefore.clone()
      const anotherPolicyInstanceAfter = anotherPolicyInstanceBefore.clone()
      policyInstanceAfter.value.name = 'policyInstance2'
      anotherPolicyInstanceAfter.value.name = 'anotherPolicyInstance2'
      const inputChanges = new Map([
        [0, toChange({ before: policyInstanceBefore, after: policyInstanceAfter })],
        [1, toChange({ before: anotherPolicyInstanceBefore, after: anotherPolicyInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await changeDependenciesFromPoliciesAndRulesToPriority(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY])(
    'should add dependencies between each %s rule only when they are belongs to the same policy',
    async (policyRuleName: string) => {
      const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleName) })
      const parentType = new ObjectType({ elemID: new ElemID(OKTA, policyRuleTypeNameToPolicyName(policyRuleName)) })
      const parentOne = new InstanceElement('parentOne', parentType, {
        id: '1',
        name: 'parentOne',
      })
      const parentTwo = new InstanceElement('parentTwo', parentType, {
        id: '2',
        name: 'parentTwo',
      })
      const policyRuleOne = new InstanceElement(
        'policyRuleOne',
        policyRuleType,
        {
          id: '1',
          name: 'policyRuleOne',
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentOne.elemID, parentOne)] },
      )
      const policyRuleTwo = new InstanceElement(
        'policyRuleTwo',
        policyRuleType,
        {
          id: '2',
          name: 'policyRuleTwo',
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentTwo.elemID, parentTwo)] },
      )
      const policyRuleThree = new InstanceElement(
        'policyRuleThree',
        policyRuleType,
        {
          id: '3',
          name: 'policyRuleThree',
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentOne.elemID, parentOne)] },
      )
      const inputChanges = new Map([
        [0, toChange({ after: policyRuleOne })],
        [1, toChange({ after: policyRuleTwo })],
        [2, toChange({ after: policyRuleThree })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await addDependenciesFromPolicyToPriorPolicy(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(2)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    "should add dependencies between each %s changes when some of them has priority and some are doesn't",
    async (policyName: string) => {
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceOne = createPolicyOrRuleInstance(policyName, 'policyInstanceOne', 1)
      const policyInstanceTwo = createPolicyOrRuleInstance(policyName, 'policyInstanceTwo', 2)
      const policyInstanceThree = createPolicyOrRuleInstance(policyName, 'policyInstanceThree', 3)
      const policyInstanceFour = createPolicyOrRuleInstance(policyName, 'policyInstanceFour', 4)
      const priorityInstance = new InstanceElement('priorityInstance', priorityType, {
        priorities: [
          new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
          new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
        ],
      })

      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceFour })],
        [1, toChange({ after: policyInstanceOne })],
        [2, toChange({ after: policyInstanceThree })],
        [3, toChange({ after: policyInstanceTwo })],
        [4, toChange({ after: priorityInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await addDependenciesFromPolicyToPriorPolicy(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(3)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(3)
      expect(dependencyChanges[0].dependency.target).toEqual(1)
      expect(dependencyChanges[1].action).toEqual('add')
      expect(dependencyChanges[1].dependency.source).toEqual(0)
      expect(dependencyChanges[1].dependency.target).toEqual(3)
      expect(dependencyChanges[2].action).toEqual('add')
      expect(dependencyChanges[2].dependency.source).toEqual(2)
      expect(dependencyChanges[2].dependency.target).toEqual(0)
    },
  )
})
