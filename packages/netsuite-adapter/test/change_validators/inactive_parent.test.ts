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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import inactiveParent from '../../src/change_validators/inactive_parent'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SOAP } from '../../src/constants'

describe('Inactive parent validator', () => {
  describe('Data element type', () => {
    const dataElementType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'test'),
      annotations: {
        source: SOAP,
      },
    })

    const inactiveInstanceWithoutParent = new InstanceElement('testInactiveInstanceWithoutParent', dataElementType, {
      isInactive: true,
    })
    const activeInstanceWithoutParent = new InstanceElement('testActiveInstanceWithoutParent', dataElementType, {
      isInactive: false,
    })
    const inactiveInstanceWithActiveParent = new InstanceElement('testInactiveInstanceWithoutParent', dataElementType, {
      isInactive: true,
      parent: new ReferenceExpression(activeInstanceWithoutParent.elemID, activeInstanceWithoutParent),
    })
    const inactiveInstanceWithInactiveParent = new InstanceElement(
      'testInactiveInstanceWithoutParent',
      dataElementType,
      {
        isInactive: true,
        parent: new ReferenceExpression(inactiveInstanceWithoutParent.elemID, inactiveInstanceWithoutParent),
      },
    )
    const activeInstanceWithActiveParent = new InstanceElement('testInactiveInstanceWithoutParent', dataElementType, {
      isInactive: false,
      parent: new ReferenceExpression(activeInstanceWithoutParent.elemID, activeInstanceWithoutParent),
    })
    const activeInstanceWithInactiveParent = new InstanceElement('testInactiveInstanceWithoutParent', dataElementType, {
      isInactive: false,
      parent: new ReferenceExpression(inactiveInstanceWithoutParent.elemID, inactiveInstanceWithoutParent),
    })

    describe('Add new element', () => {
      it('Should not have a change error when adding a new element without a parent', async () => {
        const changeErrors = await inactiveParent([toChange({ after: activeInstanceWithoutParent })])
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when adding a new element with an active parent', async () => {
        const changeErrors = await inactiveParent([toChange({ after: activeInstanceWithActiveParent })])
        expect(changeErrors).toHaveLength(0)
      })

      it('Should have a change error when adding a new element with an inactive parent', async () => {
        const changeErrors = await inactiveParent([toChange({ after: inactiveInstanceWithInactiveParent })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(inactiveInstanceWithInactiveParent.elemID)
      })
    })

    describe('Modify existing element', () => {
      describe('Modify isInactive field', () => {
        it('Should not have a change error when modifying isInactive field of an element without a parent', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: activeInstanceWithoutParent, after: inactiveInstanceWithoutParent }),
          ])
          expect(changeErrors).toHaveLength(0)
        })

        it('Should not have a change error when modifying isInactive field of an element with an active parent', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: inactiveInstanceWithActiveParent, after: activeInstanceWithActiveParent }),
          ])
          expect(changeErrors).toHaveLength(0)
        })

        it('Should not have a change error when modifying isInactive field of an element with an inactive parent', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: inactiveInstanceWithInactiveParent, after: activeInstanceWithInactiveParent }),
          ])
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('Modify parent field', () => {
        it('Should not have a change error when removing parent field', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: activeInstanceWithActiveParent, after: activeInstanceWithoutParent }),
          ])
          expect(changeErrors).toHaveLength(0)
        })

        it('Should not have a change error when modifying parent field to reference an active parent', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: inactiveInstanceWithoutParent, after: inactiveInstanceWithActiveParent }),
          ])
          expect(changeErrors).toHaveLength(0)
        })

        it('Should have a change error when modifying parent field to reference an inactive parent', async () => {
          const changeErrors = await inactiveParent([
            toChange({ before: inactiveInstanceWithoutParent, after: inactiveInstanceWithInactiveParent }),
          ])
          expect(changeErrors).toHaveLength(1)
          expect(changeErrors[0].severity).toEqual('Error')
          expect(changeErrors[0].elemID).toBe(inactiveInstanceWithInactiveParent.elemID)
        })
      })
    })

    describe('Unexpected field value', () => {
      it('Should not have a change error if isInactive field is undefined', async () => {
        const parentElement = new InstanceElement('parentElement', dataElementType)
        const childElement = new InstanceElement('testChildElement', dataElementType, {
          parent: new ReferenceExpression(parentElement.elemID, parentElement),
        })
        const changeErrors = await inactiveParent([toChange({ after: childElement })])
        expect(changeErrors).toHaveLength(0)
      })

      it('Sanity - Should not crash and should not have a change error if parent field is not a reference expression', async () => {
        const childElement = new InstanceElement('testChildElement', dataElementType, {
          isInactive: true,
          parent: 'I Am Your Father.',
        })
        const changeErrors = await inactiveParent([toChange({ after: childElement })])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('Custom record instance', () => {
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        source: SOAP,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })

    const inactiveInstanceWithoutParent = new InstanceElement('testInactiveInstanceWithoutParent', customRecordType, {
      isInactive: true,
    })
    const activeInstanceWithoutParent = new InstanceElement('testActiveInstanceWithoutParent', customRecordType, {
      isInactive: false,
    })
    const inactiveInstanceWithActiveParent = new InstanceElement(
      'testInactiveInstanceWithoutParent',
      customRecordType,
      {
        isInactive: true,
        parent: new ReferenceExpression(activeInstanceWithoutParent.elemID, activeInstanceWithoutParent),
      },
    )
    const inactiveInstanceWithInactiveParent = new InstanceElement(
      'testInactiveInstanceWithoutParent',
      customRecordType,
      {
        isInactive: true,
        parent: new ReferenceExpression(inactiveInstanceWithoutParent.elemID, inactiveInstanceWithoutParent),
      },
    )

    it('Should not have a change error when adding parent field to custom record that references an inactive parent', async () => {
      const changeErrors = await inactiveParent([
        toChange({ before: inactiveInstanceWithoutParent, after: inactiveInstanceWithInactiveParent }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it("Should not have a change error when modifying to custom record's parent field to reference an inactive parent", async () => {
      const changeErrors = await inactiveParent([
        toChange({ before: inactiveInstanceWithActiveParent, after: inactiveInstanceWithInactiveParent }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
