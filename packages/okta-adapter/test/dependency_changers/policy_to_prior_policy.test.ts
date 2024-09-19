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
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { OKTA } from '../../src/constants'
import { changeDependenciesFromPoliciesAndRulesToPriority } from '../../src/dependency_changers/policy_and_rules_to_priority'
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE } from '../../src/filters/policy_priority'
import { addDependenciesFromPolicyToPriorPolicy } from '../../src/dependency_changers/policy_to_prior_policy'

describe('addDependenciesFromPolicyToPriorPolicy', () => {
  let dependencyChanges: DependencyChange[]
  it.each([...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should add dependencies between each %s addition change when their priority is also addition change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceOne = new InstanceElement('policyInstanceOne', policyType, {
        id: '1',
        name: 'policyInstanceOne',
      })
      const policyInstanceTwo = new InstanceElement('policyInstanceTwo', policyType, {
        id: '2',
        name: 'policyInstanceTwo',
      })
      const policyInstanceThree = new InstanceElement('policyInstanceThree', policyType, {
        id: '3',
        name: 'policyInstanceThree',
      })

      const priorityInstance = new InstanceElement('priorityInstance', priorityType, {
        priorities: [
          new ReferenceExpression(policyInstanceOne.elemID, policyInstanceOne),
          new ReferenceExpression(policyInstanceTwo.elemID, policyInstanceTwo),
          new ReferenceExpression(policyInstanceThree.elemID, policyInstanceThree),
        ],
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
  it.each([...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should add dependencies between each %s addition change when their priority is modification change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceOne = new InstanceElement('policyInstanceOne', policyType, {
        id: '1',
        name: 'policyInstanceOne',
      })
      const policyInstanceTwo = new InstanceElement('policyInstanceTwo', policyType, {
        id: '2',
        name: 'policyInstanceTwo',
      })
      const policyInstanceThree = new InstanceElement('policyInstanceThree', policyType, {
        id: '3',
        name: 'policyInstanceThree',
      })
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
  it.each([...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE, ...ALL_SUPPORTED_POLICY_NAMES])(
    "should add dependencies between each %s addition change when they don't have priority change",
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const policyInstanceOne = new InstanceElement('policyInstanceOne', policyType, {
        id: '1',
        name: 'policyInstanceOne',
      })
      const policyInstanceTwo = new InstanceElement('policyInstanceTwo', policyType, {
        id: '2',
        name: 'policyInstanceTwo',
      })
      const policyInstanceThree = new InstanceElement('policyInstanceThree', policyType, {
        id: '3',
        name: 'policyInstanceThree',
      })

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
  it.each([...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should not add dependencies between each %s changes when they are modification changes',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const policyInstanceBefore = new InstanceElement('policyInstance', policyType, {
        id: '1',
        name: 'policyInstance',
      })
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
})
