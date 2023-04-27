/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression, Values, toChange, Element } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { isDefined } from '@salto-io/lowerdash/src/values'
import inactiveParent from '../../src/change_validators/inactive_parent'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SOAP } from '../../src/constants'

describe('Inactive parent validator', () => {
  const dataElementType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'test'),
    annotations: {
      source: SOAP,
    },
  })

  const getIDToIsInactive = (instances: readonly InstanceElement[]): Map<string, boolean> =>
    new Map(instances
      .map(instance =>
        [instance.elemID.createNestedID('isInactive').getFullName(),
          instance.value.isInactive]))

  const buildMockElementsSource = (
    elements: readonly Element[],
    parents?: InstanceElement[]
  ): ReadOnlyElementsSource => {
    const idToIsInactive = isDefined(parents) ? getIDToIsInactive(parents) : new Map()
    const elementSource = buildElementsSourceFromElements(elements)

    const mockGet = jest.fn().mockImplementation((id: ElemID) =>
      idToIsInactive.get(id.getFullName()) ?? elementSource.get(id))
    const mockElementsSource = {
      list: elementSource.list,
      getAll: elementSource.getAll,
      has: elementSource.has,
      get: mockGet,
    } as unknown as ReadOnlyElementsSource

    return mockElementsSource
  }

  const getInstanceElement = (
    type: ObjectType,
    isInactive: boolean | undefined,
    parent?: InstanceElement
  ): InstanceElement => {
    const value: Values = isDefined(parent) ? {
      isInactive,
      parent: new ReferenceExpression(parent.elemID, parent),
    } : {
      isInactive,
    }

    return new InstanceElement(`test ${isInactive}`, type, value)
  }

  describe('Add new element', () => {
    it('Should not have a change error when adding a new element without a parent', async () => {
      const element = getInstanceElement(dataElementType, true)
      const changeErrors = await inactiveParent(
        [toChange({ after: element })],
        undefined,
        buildMockElementsSource([element])
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when adding a new element with an active parent', async () => {
      const parentElement = getInstanceElement(dataElementType, false)
      const childElement = getInstanceElement(dataElementType, false, parentElement)
      const changeErrors = await inactiveParent(
        [toChange({ after: childElement })],
        undefined,
        buildMockElementsSource(
          [childElement, parentElement]
        )
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('Should have a change error when adding a new element with an inactive parent', async () => {
      const parentElement = getInstanceElement(dataElementType, true)
      const childElement = getInstanceElement(dataElementType, true, parentElement)
      const changeErrors = await inactiveParent(
        [toChange({ after: childElement })],
        undefined,
        buildMockElementsSource([parentElement, childElement], [parentElement])
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toBe(childElement.elemID)
    })
  })

  describe('Modify existing element', () => {
    describe('Modify isInactive field', () => {
      it('Should not have a change error when modifying isInactive field of an element without a parent', async () => {
        const elementBefore = getInstanceElement(dataElementType, false)
        const elementAfter = getInstanceElement(dataElementType, true)
        const changeErrors = await inactiveParent(
          [toChange({ before: elementBefore, after: elementAfter })],
          undefined,
          buildMockElementsSource([elementAfter])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying isInactive field of an element with an active parent', async () => {
        const parentElement = getInstanceElement(dataElementType, false)
        const childElementBefore = getInstanceElement(dataElementType, true, parentElement)
        const childElementAfter = getInstanceElement(dataElementType, false, parentElement)
        const changeErrors = await inactiveParent(
          [toChange({ before: childElementBefore, after: childElementAfter })],
          undefined,
          buildMockElementsSource([parentElement, childElementAfter], [parentElement])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying isInactive field of an element with an inactive parent', async () => {
        const parentElement = getInstanceElement(dataElementType, true)
        const childElementBefore = getInstanceElement(dataElementType, true, parentElement)
        const childElementAfter = getInstanceElement(dataElementType, false, parentElement)
        const changeErrors = await inactiveParent(
          [toChange({ before: childElementBefore, after: childElementAfter })],
          undefined,
          buildMockElementsSource([parentElement, childElementAfter], [parentElement])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Modify parent field', () => {
      it('Should not have a change error when removing parent field', async () => {
        const parentElement = getInstanceElement(dataElementType, true)
        const childElementBefore = getInstanceElement(dataElementType, true, parentElement)
        const childElementAfter = getInstanceElement(dataElementType, true)
        const changeErrors = await inactiveParent(
          [toChange({ before: childElementBefore, after: childElementAfter })],
          undefined,
          buildMockElementsSource([parentElement, childElementAfter], [parentElement])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying parent field to reference an active parent', async () => {
        const parentElementActive = getInstanceElement(dataElementType, false)
        const parentElementInactive = getInstanceElement(dataElementType, true)
        const childElementBefore = getInstanceElement(dataElementType, true, parentElementInactive)
        const childElementAfter = getInstanceElement(dataElementType, true, parentElementActive)
        const changeErrors = await inactiveParent(
          [toChange({ before: childElementBefore, after: childElementAfter })],
          undefined,
          buildMockElementsSource(
            [parentElementActive, parentElementInactive, childElementAfter],
            [parentElementActive, parentElementInactive]
          )
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should have a change error when modifying parent field to reference an inactive parent', async () => {
        const parentElementActive = getInstanceElement(dataElementType, false)
        const parentElementInactive = getInstanceElement(dataElementType, true)
        const childElementBefore = getInstanceElement(dataElementType, true, parentElementActive)
        const childElementAfter = getInstanceElement(dataElementType, true, parentElementInactive)
        const changeErrors = await inactiveParent(
          [toChange({ before: childElementBefore, after: childElementAfter })],
          undefined,
          buildMockElementsSource(
            [parentElementActive, parentElementInactive, childElementAfter],
            [parentElementActive, parentElementInactive]
          )
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(childElementAfter.elemID)
      })
    })
  })

  describe('Missing fields', () => {
    it('Should not have a change error if isInactive field is undefined', async () => {
      const parentElement = getInstanceElement(dataElementType, undefined)
      const childElement = getInstanceElement(dataElementType, undefined, parentElement)
      const changeErrors = await inactiveParent(
        [toChange({ after: childElement })],
        undefined,
        buildMockElementsSource([parentElement, childElement], [parentElement])
      )
      expect(changeErrors).toHaveLength(0)
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

    it('Should not have a change error when adding parent field to custom record that references an inactive parent', async () => {
      const parentElement = getInstanceElement(customRecordType, true)
      const childElementBefore = getInstanceElement(customRecordType, true)
      const childElementAfter = getInstanceElement(customRecordType, true, parentElement)
      const changeErrors = await inactiveParent(
        [toChange({ before: childElementBefore, after: childElementAfter })],
        undefined,
        buildMockElementsSource([parentElement, childElementAfter], [parentElement])
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when modifying to custom record\'s parent field to reference an inactive parent', async () => {
      const parentElementActive = getInstanceElement(customRecordType, false)
      const parentElementInactive = getInstanceElement(customRecordType, true)
      const childElementBefore = getInstanceElement(customRecordType, true, parentElementActive)
      const childElementAfter = getInstanceElement(customRecordType, true, parentElementInactive)
      const changeErrors = await inactiveParent(
        [toChange({ before: childElementBefore, after: childElementAfter })],
        undefined,
        buildMockElementsSource(
          [parentElementActive, parentElementInactive, childElementAfter],
          [parentElementActive, parentElementInactive]
        )
      )
      expect(changeErrors).toHaveLength(0)
    })
  })
})
