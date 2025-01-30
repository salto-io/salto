/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ReferenceInfo, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { formulaRefsHandler } from '../../src/custom_references/flow_and_flexi_page'
import { FLEXI_PAGE_TYPE, FLOW_METADATA_TYPE } from '../../src/constants'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('Flow and FlexiPage custom references', () => {
  describe('weak references handler', () => {
    let referringInstance: Element
    let elements: Element[]
    let refs: ReferenceInfo[]
    describe('Flow', () => {
      beforeEach(() => {
        referringInstance = createInstanceElement(
          {
            fullName: FLOW_METADATA_TYPE,
            assignments: [
              {
                assignmentItems: [
                  {
                    assignToReference: '$Record.Name',
                  },
                ],
              },
            ],
            decisions: [
              {
                rules: [
                  {
                    conditions: [
                      {
                        leftValueReference: '$Record.Name',
                        rightValue: {
                          elementReference: '$Record.Name',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          mockTypes.Flow,
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(mockTypes.Account.elemID)] },
        )
        elements = [referringInstance]
      })
      it('should generate references', async () => {
        refs = await formulaRefsHandler.findWeakReferences(elements)
        const target = mockTypes.Account.elemID.createNestedID('field', 'Name')
        const type = 'strong'
        const expectedRefs = [
          {
            source: referringInstance.elemID.createNestedID(
              'assignments',
              '0',
              'assignmentItems',
              '0',
              'assignToReference',
            ),
            target,
            type,
          },
          {
            source: referringInstance.elemID.createNestedID(
              'decisions',
              '0',
              'rules',
              '0',
              'conditions',
              '0',
              'leftValueReference',
            ),
            target,
            type,
          },
          {
            source: referringInstance.elemID.createNestedID(
              'decisions',
              '0',
              'rules',
              '0',
              'conditions',
              '0',
              'rightValue',
              'elementReference',
            ),
            target,
            type,
          },
        ]
        expect(refs).toIncludeSameMembers(expectedRefs)
      })
    })
    describe('FlexiPage', () => {
      beforeEach(() => {
        referringInstance = createInstanceElement(
          {
            fullName: FLEXI_PAGE_TYPE,
            flexiPageRegions: [
              {
                itemInstances: [
                  {
                    componentInstance: {
                      visibilityRule: {
                        criteria: [
                          {
                            leftValue: 'Record.Name',
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          },
          mockTypes.FlexiPage,
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(mockTypes.Account.elemID)] },
        )
        elements = [referringInstance]
      })
      it('should generate references', async () => {
        refs = await formulaRefsHandler.findWeakReferences(elements)
        const target = mockTypes.Account.elemID.createNestedID('field', 'Name')
        const type = 'strong'
        const expectedRefs = [
          {
            source: referringInstance.elemID.createNestedID(
              'flexiPageRegions',
              '0',
              'itemInstances',
              '0',
              'componentInstance',
              'visibilityRule',
              'criteria',
              '0',
              'leftValue',
            ),
            target,
            type,
          },
        ]
        expect(refs).toIncludeSameMembers(expectedRefs)
      })
    })
  })
})
