/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceInfo } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { formulaRefsHandler } from '../../src/custom_references/flow_and_flexi_page'
import { SALESFORCE } from '../../src/constants'

describe('formulaRefs', () => {
  describe('weak references handler', () => {
    const referredInstance = new InstanceElement('SomeLabel', mockTypes.CustomLabel, { fullName: 'SomeLabel' })
    let refs: ReferenceInfo[]
    describe('Flow', () => {
      describe('FlowCondition.leftValueReference', () => {
        const referringInstance = new InstanceElement('SomeFlow', mockTypes.Flow, {
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

        describe('when there is a valid reference', () => {
          const elements = [referringInstance, referredInstance].map(element => element.clone())

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
            expect(refs[0].type).toEqual('strong')
          })
        })
        describe('when the reference is not valid', () => {
          const elements = [referringInstance].map(element => element.clone())

          beforeEach(async () => {
            refs = await formulaRefsHandler.findWeakReferences(elements)
          })

          it('should still generate a reference', () => {
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
            expect(refs[0].type).toEqual('strong')
          })
        })
      })
      describe('FlowAssignmentItem.assignToReference', () => {
        const referringInstance = new InstanceElement('SomeFlow', mockTypes.Flow, {
          assignments: [
            {
              assignmentItems: [
                {
                  assignToReference: '$Label.SomeLabel',
                },
              ],
            },
          ],
        })

        describe('when there is a valid reference', () => {
          const elements = [referringInstance, referredInstance].map(element => element.clone())

          beforeEach(async () => {
            refs = await formulaRefsHandler.findWeakReferences(elements)
          })

          it('should generate references', () => {
            expect(refs).toHaveLength(1)
            expect(refs[0].target).toSatisfy(e => e.isEqual(referredInstance.elemID))
            expect(refs[0].source).toSatisfy(e =>
              e.isEqual(
                referringInstance.elemID.createNestedID(
                  'assignments',
                  '0',
                  'assignmentItems',
                  '0',
                  'assignToReference',
                ),
              ),
            )
            expect(refs[0].type).toEqual('strong')
          })
        })
      })
    })
    describe('FlowTest', () => {
      const flowTestType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'FlowTest'),
        fields: {},
      })
      describe('FlowTestCondition.leftValueReference', () => {
        const referringInstance = new InstanceElement('SomeFlowTest', flowTestType, {
          testPoints: [
            {
              assertions: [
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
        describe('when there is a valid reference', () => {
          const elements = [referringInstance, referredInstance].map(element => element.clone())

          beforeEach(async () => {
            refs = await formulaRefsHandler.findWeakReferences(elements)
          })

          it('should generate references', () => {
            expect(refs).toHaveLength(1)
            expect(refs[0].target).toSatisfy(e => e.isEqual(referredInstance.elemID))
            expect(refs[0].source).toSatisfy(e =>
              e.isEqual(
                referringInstance.elemID.createNestedID(
                  'testPoints',
                  '0',
                  'assertions',
                  '0',
                  'conditions',
                  '0',
                  'leftValueReference',
                ),
              ),
            )
            expect(refs[0].type).toEqual('strong')
          })
        })
      })
      describe('FlowTestParameter.leftValueReference', () => {
        const referringInstance = new InstanceElement('SomeFlowTest', flowTestType, {
          testPoints: [
            {
              parameters: [
                {
                  leftValueReference: '$Label.SomeLabel',
                },
              ],
            },
          ],
        })
        describe('when there is a valid reference', () => {
          const elements = [referringInstance, referredInstance].map(element => element.clone())

          beforeEach(async () => {
            refs = await formulaRefsHandler.findWeakReferences(elements)
          })

          it('should generate references', () => {
            expect(refs).toHaveLength(1)
            expect(refs[0].target).toSatisfy(e => e.isEqual(referredInstance.elemID))
            expect(refs[0].source).toSatisfy(e =>
              e.isEqual(
                referringInstance.elemID.createNestedID('testPoints', '0', 'parameters', '0', 'leftValueReference'),
              ),
            )
            expect(refs[0].type).toEqual('strong')
          })
        })
      })
    })
  })
})
