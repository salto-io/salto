/*
 * Copyright 2025 Salto Labs Ltd.
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
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_WITH_PRIORITY } from '../../src/filters/policy_priority'

describe('changeDependenciesFromPoliciesAndRulesToPriority', () => {
  let dependencyChanges: DependencyChange[]
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should add dependencies from %sPriority to its priority when they are both modification change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
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
      const priorityInstanceBefore = new InstanceElement('priorityInstance', priorityType, {
        priorities: [
          new ReferenceExpression(policyInstanceBefore.elemID, policyInstanceBefore),
          new ReferenceExpression(anotherPolicyInstanceBefore.elemID, anotherPolicyInstanceBefore),
        ],
      })
      const priorityInstanceAfter = priorityInstanceBefore.clone()
      priorityInstanceAfter.value.priorities = [
        new ReferenceExpression(anotherPolicyInstanceAfter.elemID, anotherPolicyInstanceAfter),
        new ReferenceExpression(policyInstanceAfter.elemID, policyInstanceAfter),
      ]
      const inputChanges = new Map([
        [0, toChange({ before: policyInstanceBefore, after: policyInstanceAfter })],
        [1, toChange({ before: priorityInstanceBefore, after: priorityInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await changeDependenciesFromPoliciesAndRulesToPriority(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(1)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should not add dependencies from %sPriority to its priority when %s is addition change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceAfter = new InstanceElement('policyInstance', policyType, {
        id: '1',
        name: 'policyInstance',
      })
      const priorityInstanceBefore = new InstanceElement('priorityInstance', priorityType, {
        priorities: [new ReferenceExpression(policyInstanceAfter.elemID, policyInstanceAfter)],
      })
      const priorityInstanceAfter = priorityInstanceBefore.clone()
      priorityInstanceAfter.value.priorities = []
      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceAfter })],
        [1, toChange({ before: priorityInstanceBefore, after: priorityInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await changeDependenciesFromPoliciesAndRulesToPriority(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should not add dependencies from %sPriority to its priority when priority is addition change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceBefore = new InstanceElement('policyInstance', policyType, {
        id: '1',
        name: 'policyInstance',
      })
      const policyInstanceAfter = policyInstanceBefore.clone()
      policyInstanceAfter.value.name = 'policyInstance2'
      const priorityInstanceAfter = new InstanceElement('priorityInstance', priorityType, {
        priorities: [new ReferenceExpression(policyInstanceAfter.elemID, policyInstanceAfter)],
      })
      const inputChanges = new Map([
        [0, toChange({ before: policyInstanceBefore, after: policyInstanceAfter })],
        [1, toChange({ after: priorityInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await changeDependenciesFromPoliciesAndRulesToPriority(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    },
  )
  it.each([...POLICY_RULE_WITH_PRIORITY, ...ALL_SUPPORTED_POLICY_NAMES])(
    'should not add dependencies from %sPriority to its priority when both are addition change',
    async (policyName: string) => {
      const policyType = new ObjectType({ elemID: new ElemID(OKTA, policyName) })
      const priorityType = new ObjectType({ elemID: new ElemID(OKTA, `${policyName}Priority`) })
      const policyInstanceAfter = new InstanceElement('policyInstance', policyType, {
        id: '1',
        name: 'policyInstance',
      })
      const priorityInstanceAfter = new InstanceElement('priorityInstance', priorityType, {
        priorities: [new ReferenceExpression(policyInstanceAfter.elemID, policyInstanceAfter)],
      })
      const inputChanges = new Map([
        [0, toChange({ after: policyInstanceAfter })],
        [1, toChange({ after: priorityInstanceAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await changeDependenciesFromPoliciesAndRulesToPriority(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    },
  )
})
