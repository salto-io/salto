/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, ReferenceInfo } from '@salto-io/adapter-api'
import { METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { formulaRefsHandler } from '../../src/custom_references/formula_refs'

describe('formulaRefs', () => {
  const flowConditionObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'FlowCondition'),
    annotations: { [METADATA_TYPE]: 'FlowCondition' },
    fields: {
      leftValueReference: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const flowRuleObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'FlowRule'),
    annotations: { [METADATA_TYPE]: 'FlowRule' },
    fields: { conditions: { refType: new ListType(flowConditionObjectType) } },
  })

  const flowDecisionObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'FlowDecision'),
    annotations: { [METADATA_TYPE]: 'FlowDecision' },
    fields: { rules: { refType: new ListType(flowRuleObjectType) } },
  })

  const flowType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Flow'),
    annotations: { [METADATA_TYPE]: 'Flow' },
    fields: {
      decisions: { refType: flowDecisionObjectType },
    },
  })

  const referringInstance = new InstanceElement('SomeFlow', flowType, {
    decisions: [
      {
        rules: [
          {
            conditions: [
              {
                leftValueReference: '$Label.SomeLabel',
              },
            ],
          },
        ],
      },
    ],
  })

  describe('weak references handler', () => {
    let refs: ReferenceInfo[]
    describe('when there is a valid reference', () => {
      const referredInstance = new InstanceElement('SomeLabel', mockTypes.CustomLabel, { fullName: 'SomeLabel' })
      const elements = [flowConditionObjectType, referringInstance, referredInstance].map(element => element.clone())

      beforeEach(async () => {
        refs = await formulaRefsHandler.findWeakReferences(elements)
      })

      it('should generate references', () => {
        expect(refs).toHaveLength(1)
        expect(refs[0].target).toSatisfy(e => e.isEqual(referredInstance.elemID))
        expect(refs[0].source).toSatisfy(e =>
          e.isEqual(
            referringInstance.elemID.createNestedID(
              'decisions',
              '0',
              'rules',
              '0',
              'conditions',
              '0',
              'leftValueReference',
            ),
          ),
        )
        expect(refs[0].type).toEqual('weak')
      })
    })
    describe('when the reference is not valid', () => {
      const elements = [flowConditionObjectType, referringInstance].map(element => element.clone())

      beforeEach(async () => {
        refs = await formulaRefsHandler.findWeakReferences(elements)
      })

      it('should replace the field value with a reference expression', () => {
        expect(refs).toBeEmpty()
      })
    })
  })
})
