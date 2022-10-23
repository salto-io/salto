/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  Change,
  Element,
  ElemID,
  getChangeData,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { mockTypes, mockInstances } from '../mock_elements'
import { defaultFilterContext } from '../utils'
import makeFilter, { ServiceMDTRecordValue } from '../../src/filters/custom_metadata'
import { FilterWith } from '../../src/filter'
import { MetadataInstanceElement, createInstanceElement, MetadataValues, Types } from '../../src/transformers/transformer'
import { API_NAME, CUSTOM_METADATA, METADATA_TYPE, SALESFORCE, XML_ATTRIBUTE_PREFIX } from '../../src/constants'

type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
describe('CustomMetadata filter', () => {
  const CUSTOM_METADATA_RECORD_TYPE_NAME = 'MDType__mdt'
  const customMetadataRecordType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_RECORD_TYPE_NAME),
    fields: {
      textField__c: { refType: Types.primitiveDataTypes.Text },
      nullableNumberField__c: { refType: Types.primitiveDataTypes.Number },
    },
    annotations: {
      [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
      [METADATA_TYPE]: CUSTOM_METADATA,
    },
  })
  const createCustomMetadataInstanceFromService = (
    values: ServiceMDTRecordValue & MetadataValues
  ): MetadataInstanceElement => (
    createInstanceElement(
      { ...values, 'attr_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance' },
      mockTypes.CustomMetadata,
    )
  )

  describe('onFetch', () => {
    let filter: FilterType
    beforeEach(() => {
      filter = makeFilter({ config: defaultFilterContext }) as FilterType
    })
    describe('with no custom metadata records', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = [
          ...Object.values(mockInstances()),
          ...Object.values(mockTypes),
        ]
        await filter.onFetch(elements)
      })
      it('should not change any elements', () => {
        expect(elements).toEqual([
          ...Object.values(mockInstances()),
          ...Object.values(mockTypes),
        ])
      })
    })
    describe('with custom metadata records', () => {
      let singleValueInstance: MetadataInstanceElement
      let nullValueInstance: MetadataInstanceElement
      beforeEach(async () => {
        singleValueInstance = createCustomMetadataInstanceFromService({
          fullName: 'MDType.InstWithSingleValue',
          values: { field: 'textField__c', value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' } },
        })
        nullValueInstance = createCustomMetadataInstanceFromService({
          fullName: 'MDType.InstWithNullValue',
          values: [
            { field: 'textField__c', value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' } },
            { field: 'nullableNumberField__c', value: { 'attr_xsi:nil': 'true' } },
          ],
        })
        const elements = [mockTypes.CustomMetadata, singleValueInstance,
          nullValueInstance, customMetadataRecordType]
        await filter.onFetch(elements)
        singleValueInstance = elements
          .find(e => _.get(e, 'value.fullName') === singleValueInstance.value.fullName) as MetadataInstanceElement
        nullValueInstance = elements
          .find(e => _.get(e, 'value.fullName') === nullValueInstance.value.fullName) as MetadataInstanceElement
      })
      it('should convert instance.value.values to fields', () => {
        expect(singleValueInstance.value.values).toBeUndefined()
        expect(singleValueInstance.value.textField__c).toEqual('value')
      })
      it('should not convert null values to fields', async () => {
        expect(nullValueInstance.value.values).toBeUndefined()
        expect(nullValueInstance.value.nullableNumberField__c).toBeUndefined()
      })
      it('should remove XML namespace attributes', () => {
        expect(nullValueInstance.value).not.toContainKey(
          expect.stringMatching(new RegExp(`^${XML_ATTRIBUTE_PREFIX}.*`))
        )
      })
      it('should convert to the correct type', async () => {
        const instanceType = await singleValueInstance.getType()
        expect(instanceType).toEqual(customMetadataRecordType)
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    const naclValues = {
      fullName: 'MDType.InstWithNullValue',
      textField__c: 'value',
    }
    let filter: FilterType
    beforeAll(() => {
      // Note - intentionally using the same filter and "beforeAll" to mimic real flow where
      // the same filter instance would be used in both preDeploy and onDeploy
      filter = makeFilter({ config: defaultFilterContext }) as FilterType
    })
    describe('preDeploy', () => {
      let initialChange: Change<MetadataInstanceElement>
      let afterPreDeployInstance: MetadataInstanceElement
      let afterOnDeployChange: Change
      beforeAll(async () => {
        const initialInstance = createInstanceElement(naclValues, customMetadataRecordType)
        initialChange = toChange({ after: initialInstance })
        const changes = [initialChange]
        await filter.preDeploy(changes)
        afterPreDeployInstance = getChangeData(changes[0]) as MetadataInstanceElement
        const onDeployChanges = [toChange({ after: afterPreDeployInstance })]
        await filter.onDeploy(onDeployChanges)
        // eslint-disable-next-line prefer-destructuring
        afterOnDeployChange = onDeployChanges[0]
      })
      it('should create "values" from custom fields', () => {
        expect(afterPreDeployInstance.value.values).toEqual([
          { field: 'textField__c', value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' } },
          // Should handle null values
          { field: 'nullableNumberField__c', value: { 'attr_xsi:nil': 'true' } },
        ])
      })
      it('should convert deployed instance type to CustomMetadata', async () => {
        const instanceType = await afterPreDeployInstance.getType()
        expect(instanceType.elemID).toEqual(mockTypes.CustomMetadata.elemID)
      })
      it('should add XML namespace attributes', () => {
        expect(afterPreDeployInstance.value).toHaveProperty(
          `${XML_ATTRIBUTE_PREFIX}xmlns:xsd`,
          'http://www.w3.org/2001/XMLSchema',
        )
        expect(afterPreDeployInstance.value).toHaveProperty(
          `${XML_ATTRIBUTE_PREFIX}xmlns:xsi`,
          'http://www.w3.org/2001/XMLSchema-instance',
        )
      })
      it('should revert to the initial change after onDeploy', () => {
        expect(afterOnDeployChange).toEqual(initialChange)
      })
    })
  })
})
