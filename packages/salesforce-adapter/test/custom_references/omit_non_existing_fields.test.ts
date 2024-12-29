/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { omitNonExistingFieldsHandler } from '../../src/custom_references/omit_non_existing_fields'
import { mockTypes } from '../mock_elements'

describe('custom metadata and data types non existing fields', () => {
  const customObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'customObjectType'),
    annotations: { [API_NAME]: 'api__c', [METADATA_TYPE]: CUSTOM_OBJECT },
    fields: {
      fullName: new Field(
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
        'fullName',
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
      ),
      sdf__c: new Field(
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
        'anotherField__c',
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
      ),
    },
  })
  const metadataType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'metadataType'),
    annotations: { [API_NAME]: 'api__mdt' },
    fields: {
      id: new Field(
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
        'fullName',
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
      ),
      sdf__c: new Field(
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
        'anotherField__c',
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'testTypeField') }),
      ),
    },
  })
  const flowType = mockTypes.Flow
  const customObjectElementExtraValues = new InstanceElement('instance', customObjectType, {
    fullName: 'asd',
    sdf__c: 'sdf',
    dfg__c: 'dfg',
    qwerty: 'qwert',
    id: 'fake',
    customObjectElementExtraValues: 'fake',
  })
  const customObjectElement = new InstanceElement('instance', customObjectType, {
    fullName: 'asd',
    sdf__c: 'sdf',
  })
  const dataTypeElementExtraValues = new InstanceElement('instance', metadataType, {
    id: 'asd',
    sdf__c: 'sdf',
    dfg__c: 'dfg',
    qwerty: 'qwert',
    fullName: 'fake',
    dataTypeElementExtraValues: 'fake',
  })
  const dataTypeElement = new InstanceElement('instance', metadataType, {
    id: 'asd',
    sdf__c: 'sdf',
  })
  const flowElement = new InstanceElement('instance', flowType, {
    status: 'asd',
    fake__c: 'sdf',
    flowElement: 'fake',
  })
  const elementsSource = buildElementsSourceFromElements([])
  const fixElementsFunc = omitNonExistingFieldsHandler.removeWeakReferences({
    elementsSource,
    config: {
      fetch: {
        metadata: {
          include: [
            {
              metadataType: '.*',
              name: '.*',
              namespace: '',
            },
          ],
        },
      },
    },
  })

  describe('when receiving multiple elements', () => {
    describe("when some have only values that exist in the type's fields, and some have values that don't exist in the type's fields", () => {
      it("should omit values that don't exist in the type's fields not change the rest", async () => {
        const { fixedElements, errors } = await fixElementsFunc([
          customObjectElement,
          customObjectElementExtraValues,
          dataTypeElement,
          dataTypeElementExtraValues,
          flowElement,
        ])
        expect(fixedElements).toHaveLength(2)
        const ele0 = fixedElements[0] as InstanceElement
        expect(Object.keys(ele0.value)).toContain('fullName')
        expect(Object.keys(ele0.value)).toContain('sdf__c')
        expect(Object.keys(ele0.value)).not.toContain('qwerty')
        expect(Object.keys(ele0.value)).not.toContain('dfg__c')
        expect(Object.keys(ele0.value)).not.toContain('id')
        expect(Object.keys(ele0.value)).not.toContain('customObjectElementExtraValues')
        const ele1 = fixedElements[1] as InstanceElement
        expect(Object.keys(ele1.value)).toContain('id')
        expect(Object.keys(ele1.value)).toContain('sdf__c')
        expect(Object.keys(ele1.value)).not.toContain('qwerty')
        expect(Object.keys(ele1.value)).not.toContain('dfg__c')
        expect(Object.keys(ele1.value)).not.toContain('fullName')
        expect(Object.keys(ele1.value)).not.toContain('dataTypeElementExtraValues')
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(customObjectElementExtraValues.elemID)
        expect(errors[1].elemID).toEqual(dataTypeElement.elemID)
      })
    })
  })
})
