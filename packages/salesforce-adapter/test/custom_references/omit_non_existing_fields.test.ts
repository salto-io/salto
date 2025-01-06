/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, Field, FixElementsFunc, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { CUSTOM_METADATA_SUFFIX, SALESFORCE } from '../../src/constants'
import { omitNonExistingFieldsHandler } from '../../src/custom_references/omit_non_existing_fields'
import { mockTypes } from '../mock_elements'
import { createCustomMetadataType, createCustomObjectType } from '../utils'

describe('custom object and custom metadata types non existing fields', () => {
  let field: Field
  let customObjectType: ObjectType
  let metadataType: ObjectType
  let flowType: ObjectType
  let customObjectElementExtraValues: InstanceElement
  let customObjectElement: InstanceElement
  let customMetaDataTypeElementExtraValues: InstanceElement
  let customMetaDataTypeElement: InstanceElement
  let flowElement: InstanceElement
  let fixElementsFunc: FixElementsFunc
  beforeEach(() => {
    field = new Field(
      new ObjectType({ elemID: new ElemID(SALESFORCE, 'testField') }),
      'fieldName',
      new ObjectType({ elemID: new ElemID(SALESFORCE, 'testField') }),
    )
    fixElementsFunc = omitNonExistingFieldsHandler.removeWeakReferences({
      elementsSource: buildElementsSourceFromElements([]),
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

    customObjectType = createCustomObjectType('customObjectType', {
      fields: {
        customObjectElementExtraValues__c: field,
      },
    })
    metadataType = createCustomMetadataType(['metadataType', CUSTOM_METADATA_SUFFIX].join(''), {
      fields: {
        dataTypeElementExtraValues__c: field,
        fullName: field,
        sdf__c: field,
      },
    })
    flowType = mockTypes.Flow
  })

  describe('when data instance contains values that are not defined in the type', () => {
    it('should omit those values', async () => {
      customObjectElementExtraValues = new InstanceElement('instance', customObjectType, {
        Id: 'asd',
        Name: 'sdf',
        customObjectElementExtraValues__c: 'fake',
        dfg__c: 'dfg',
        qwerty: 'qwert',
        id: 'fake',
      })
      const { fixedElements, errors } = await fixElementsFunc([customObjectElementExtraValues])
      expect(fixedElements).toHaveLength(1)
      const ele = fixedElements[0] as InstanceElement
      expect(ele.value).toEqual({ Id: 'asd', Name: 'sdf', customObjectElementExtraValues__c: 'fake' })
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(customObjectElementExtraValues.elemID)
    })
  })
  describe("when custom object with only values that are defined in the type's fields", () => {
    it('should not change the instance', async () => {
      customObjectElement = new InstanceElement('instance', customObjectType, {
        Id: 'asd',
        Name: 'sdf',
      })
      const { fixedElements, errors } = await fixElementsFunc([customObjectElement])
      expect(fixedElements).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })
  })
  describe("when custom metadata type with values that are not defined in the type's fields", () => {
    it('should omit those values', async () => {
      customMetaDataTypeElementExtraValues = new InstanceElement('instance', metadataType, {
        fullName: 'real',
        dataTypeElementExtraValues__c: 'real',
        sdf__c: 'real',
        id: 'fake',
        dfg__c: 'dfg',
        qwerty: 'qwert',
      })
      const { fixedElements, errors } = await fixElementsFunc([customMetaDataTypeElementExtraValues])
      expect(fixedElements).toHaveLength(1)
      const ele = fixedElements[0] as InstanceElement
      expect(ele.value).toEqual({ fullName: 'real', dataTypeElementExtraValues__c: 'real', sdf__c: 'real' })
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(customMetaDataTypeElementExtraValues.elemID)
    })
  })
  describe('when CustomMetadata instance does not contain values that are not defined in the type', () => {
    it('should not change the instance', async () => {
      customMetaDataTypeElement = new InstanceElement('instance', metadataType, {
        fullName: 'asd',
        sdf__c: 'sdf',
        dataTypeElementExtraValues__c: 'real',
      })
      const { fixedElements, errors } = await fixElementsFunc([customMetaDataTypeElement])
      expect(fixedElements).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })
  })
  describe('when instance is neither custom metadata type nor custom object', () => {
    it("should not change the instance regardless of it's values", async () => {
      flowElement = new InstanceElement('instance', flowType, {
        status: 'asd',
        fake__c: 'sdf',
        flowElement: 'fake',
      })
      const { fixedElements, errors } = await fixElementsFunc([flowElement])
      expect(fixedElements).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })
  })
})
