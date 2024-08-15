/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { OKTA, ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME, ACCESS_POLICY_RULE_TYPE_NAME } from '../../src/constants'
import { policyPrioritiesHandler } from '../../src/weak_references/policy_priorities'

describe('policyRulePrioritiesHandler', () => {
  const ruleType = new ObjectType({
    elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })
  let ruleInstance: InstanceElement
  const policyRulePriorityType = new ObjectType({
    elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME),
    fields: {
      priorities: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
  })
  let policyRulePriorityInstance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    ruleInstance = new InstanceElement('rule1', ruleType, { id: 'ruleId', name: 'rule1' })
    elementsSource = buildElementsSourceFromElements([ruleInstance])

    policyRulePriorityInstance = new InstanceElement('policyRulePriorityInstance', policyRulePriorityType, {
      priorities: [
        'priority1',
        new ReferenceExpression(new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME, 'instance', 'rule1')),
        new ReferenceExpression(new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME, 'instance', 'rule2')),
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references rules', async () => {
      const references = await policyPrioritiesHandler.findWeakReferences([policyRulePriorityInstance])

      expect(references).toEqual([
        {
          source: policyRulePriorityInstance.elemID.createNestedID('priorities', '1'),
          target: ruleInstance.elemID,
          type: 'weak',
        },
        {
          source: policyRulePriorityInstance.elemID.createNestedID('priorities', '2'),
          target: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME, 'instance', 'rule2'),
          type: 'weak',
        },
      ])
    })

    it('should do nothing if received invalid policyRulePriorityInstance', async () => {
      policyRulePriorityInstance.value.priorities = 'invalid'
      const references = await policyPrioritiesHandler.findWeakReferences([policyRulePriorityInstance])

      expect(references).toEqual([])
    })

    it('should do nothing if there are no priorities', async () => {
      delete policyRulePriorityInstance.value.priorities
      const references = await policyPrioritiesHandler.findWeakReferences([policyRulePriorityInstance])

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid rules', async () => {
      const fixes = await policyPrioritiesHandler.removeWeakReferences({ elementsSource })([policyRulePriorityInstance])

      expect(fixes.errors).toEqual([
        {
          elemID: policyRulePriorityInstance.elemID.createNestedID('priorities'),
          severity: 'Info',
          message: 'Deploying AccessPolicyRulePriority without all attached priorities for rules',
          detailedMessage:
            'This AccessPolicyRulePriority is attached to some rules that do not exist in the target environment. It will be deployed without referencing these.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.priorities).toEqual([
        new ReferenceExpression(new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME, 'instance', 'rule1')),
      ])
    })
    it('should do nothing if there are no priorities', async () => {
      delete policyRulePriorityInstance.value.priorities
      const fixes = await policyPrioritiesHandler.removeWeakReferences({ elementsSource })([policyRulePriorityInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all priorities are valid', async () => {
      policyRulePriorityInstance.value.priorities = [
        new ReferenceExpression(new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME, 'instance', 'rule1')),
      ]
      const fixes = await policyPrioritiesHandler.removeWeakReferences({ elementsSource })([policyRulePriorityInstance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
