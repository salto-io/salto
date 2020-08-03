/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  Element, ElemID, ObjectType, PrimitiveTypes, PrimitiveType, CORE_ANNOTATIONS, InstanceElement,
  ReferenceExpression, isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import filterCreator from '../../src/filters/custom_object_instances_references'
import referenceAnnotationfilterCreator from '../../src/filters/reference_annotations'
import mockAdapter from '../adapter'
import { SALESFORCE, API_NAME, CUSTOM_OBJECT, METADATA_TYPE, LABEL } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'

describe('Custom Object Instances References filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  let refAnnotationFilter: FilterType

  const refFromName = 'refFrom'
  const refToName = 'refToName'
  const masterName = 'masterName'
  const stringType = new PrimitiveType({
    elemID: new ElemID(SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const masterElemID = new ElemID(SALESFORCE, masterName)
  const masterObj = new ObjectType({
    elemID: masterElemID,
    annotations: {
      [API_NAME]: masterName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
    fields: {
      Id: {
        type: stringType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [LABEL]: 'Id',
          [API_NAME]: 'Id',
        },
      },
    },
  })
  const refToElemID = new ElemID(SALESFORCE, refToName)
  const refToObj = new ObjectType({
    elemID: refToElemID,
    annotations: {
      [API_NAME]: refToName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
    fields: {
      Id: {
        type: stringType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [LABEL]: 'Id',
          [API_NAME]: 'Id',
        },
      },
    },
  })
  const refFromElemID = new ElemID(SALESFORCE, refFromName)
  const refFromObj = new ObjectType(
    {
      elemID: refFromElemID,
      annotations: {
        [API_NAME]: refFromName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        Id: {
          type: stringType,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [LABEL]: 'Id',
            [API_NAME]: 'Id',
          },
        },
        LookupExample: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [LABEL]: 'lookup',
            [API_NAME]: 'LookupExample',
            referenceTo: [
              refToName,
              'invalidName',
            ],
          },
        },
        MasterDetailExample: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [LABEL]: 'detailfOfMaster',
            [API_NAME]: 'MasterDetailExample',
            referenceTo: [
              masterName,
            ],
          },
        },
      },
    }
  )

  beforeAll(() => {
    ({ client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator({ client, config: {} }) as FilterType
    refAnnotationFilter = referenceAnnotationfilterCreator({ client, config: {} }) as FilterType
  })

  describe('lookup ref to', () => {
    let originalElements: Element[]
    const refFromValues = {
      Id: '1234',
      LookupExample: 'refToId',
      MasterDetailExample: 'masterToId',
    }
    const refToInstanceName = 'refToInstance'
    const refToInstance = new InstanceElement(
      refToInstanceName,
      refToObj,
      {
        Id: 'refToId',
      },
    )
    const refFromEmptyRefsValues = {
      Id: '5678',
      LookupExample: 'refToNothing',
      MasterDetailExample: 'masterOfNone',
    }
    const refFromEmptyRefsName = 'refFromEmptyRefsValues'
    const refFromEmptyRefsInstance = new InstanceElement(
      refFromEmptyRefsName,
      refFromObj,
      refFromEmptyRefsValues,
    )
    const refFromInstanceName = 'refFromInstance'
    const refFromInstance = new InstanceElement(
      refFromInstanceName,
      refFromObj,
      refFromValues
    )
    const masterToInstanceName = 'masterToInstance'
    const masterToInstance = new InstanceElement(
      masterToInstanceName,
      masterObj,
      {
        Id: 'masterToId',
      },
    )
    const elements = [
      refFromObj,
      refToObj,
      masterObj,
      refToInstance,
      refFromInstance,
      masterToInstance,
      refFromEmptyRefsInstance,
    ]
    let resolvedRefFromObj: Element
    beforeAll(async () => {
      // must clone in this direction to avoid breaking the link from instances to objects
      originalElements = elements.map(e => e.clone())
      // run the reference annotation filter to resolve the REFERENCE_TO references
      await refAnnotationFilter.onFetch(elements)
      // resolvedRefFromObj has reference expressions for REFERENCE_TO instead of strings
      resolvedRefFromObj = elements[0].clone()
      await filter.onFetch(elements)
    })

    it('should not change # of elements, the objects and the ref to instances', () => {
      expect(elements.length).toEqual(originalElements.length)

      // object types
      expect(elements.find(e => e.elemID.isEqual(refFromElemID))).toMatchObject(resolvedRefFromObj)
      expect(elements.find(e => e.elemID.isEqual(refToElemID))).toMatchObject(refToObj)
      expect(elements.find(e => e.elemID.isEqual(masterElemID))).toMatchObject(masterObj)

      // instances with refs to only
      expect(elements.find(e => e.elemID.isEqual(refToInstance.elemID)))
        .toMatchObject(refToInstance)
      expect(elements.find(e => e.elemID.isEqual(masterToInstance.elemID)))
        .toMatchObject(masterToInstance)
    })

    it('should replace lookup and master values with reference', () => {
      const afterFilterRefToInst = elements.find(e => e.elemID.isEqual(refFromInstance.elemID))
      expect(afterFilterRefToInst).toBeDefined()
      expect(isInstanceElement(afterFilterRefToInst)).toBeTruthy()
      expect((afterFilterRefToInst as InstanceElement).value.LookupExample)
        .toEqual(new ReferenceExpression(refToInstance.elemID))
      expect((afterFilterRefToInst as InstanceElement).value.MasterDetailExample)
        .toEqual(new ReferenceExpression(masterToInstance.elemID))
    })

    it('should keep the value if "empty" ref (no instance with this id)', () => {
      const afterFilterEmptyRefToInst = elements.find(
        e => e.elemID.isEqual(refFromEmptyRefsInstance.elemID)
      )
      expect(afterFilterEmptyRefToInst).toBeDefined()
      expect(isInstanceElement(afterFilterEmptyRefToInst)).toBeTruthy()
      expect((afterFilterEmptyRefToInst as InstanceElement).value.LookupExample)
        .toEqual(refFromEmptyRefsValues.LookupExample)
      expect((afterFilterEmptyRefToInst as InstanceElement).value.MasterDetailExample)
        .toEqual(refFromEmptyRefsValues.MasterDetailExample)
    })
  })
})
