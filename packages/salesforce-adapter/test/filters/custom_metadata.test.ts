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
import { Element, toChange } from '@salto-io/adapter-api'
import { mockTypes, mockInstances } from '../mock_elements'
import { defaultFilterContext } from '../utils'
import makeFilter, { ServiceMDTRecordValue, NaclMDTRecordValue } from '../../src/filters/custom_metadata'
import { FilterWith } from '../../src/filter'
import { MetadataInstanceElement, createInstanceElement, MetadataValues } from '../../src/transformers/transformer'
import { XML_ATTRIBUTE_PREFIX } from '../../src/constants'

type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
describe('CustomMetadata filter', () => {
  const createCustomMetadataInstanceFromService = (
    values: ServiceMDTRecordValue & MetadataValues
  ): MetadataInstanceElement => (
    createInstanceElement(
      { ...values, 'attr_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance' },
      mockTypes.CustomMetadata,
    )
  )

  const createCustomMetadataInstanceFromNacl = (
    values: NaclMDTRecordValue & MetadataValues
  ): MetadataInstanceElement => (
    createInstanceElement(values, mockTypes.CustomMetadata)
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
          values: { field: 'Field__c', value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' } },
        })
        nullValueInstance = createCustomMetadataInstanceFromService({
          fullName: 'MDType.InstWithNullValue',
          values: [
            { field: 'Field__c', value: { 'attr_xsi:type': 'xsd:double', '#text': '10.0' } },
            { field: 'Field2__c', value: { 'attr_xsi:nil': 'true' } },
          ],
        })
        const elements = [mockTypes.CustomMetadata, singleValueInstance, nullValueInstance]
        await filter.onFetch(elements)
      })
      it('should convert single value to array', () => {
        expect(singleValueInstance.value.values).toBeArray()
      })
      it('should move xsi type attributes to the type field', () => {
        expect(singleValueInstance.value.values[0]).toHaveProperty('type', 'xsd:string')
      })
      it('should handle null values by omitting the value and type', () => {
        expect(nullValueInstance.value.values[1]).toEqual({ field: 'Field2__c' })
      })
      it('should remove XML namespace attributes', () => {
        expect(nullValueInstance.value).not.toContainKey(
          expect.stringMatching(new RegExp(`^${XML_ATTRIBUTE_PREFIX}.*`))
        )
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    const naclValues = {
      fullName: 'MDType.InstWithNullValue',
      values: [
        { field: 'Field__c', value: '10.0', type: 'xsd:double' },
        { field: 'Field2__c' },
      ],
    }
    let filter: FilterType
    beforeAll(() => {
      // Note - intentionally using the same filter and "beforeAll" to mimic real flow where
      // the same filter instance would be used in both preDeploy and onDeploy
      filter = makeFilter({ config: defaultFilterContext }) as FilterType
    })
    describe('preDeploy', () => {
      let changeInstance: MetadataInstanceElement
      beforeAll(async () => {
        changeInstance = createCustomMetadataInstanceFromNacl(_.cloneDeep(naclValues))
        await filter.preDeploy([toChange({ after: changeInstance })])
      })
      it('should convert structure of values', () => {
        expect(changeInstance.value.values[0]).toEqual({
          field: 'Field__c', value: { 'attr_xsi:type': 'xsd:double', '#text': '10.0' },
        })
      })
      it('should handle null values', () => {
        expect(changeInstance.value.values[1]).toEqual({
          field: 'Field2__c', value: { 'attr_xsi:nil': 'true' },
        })
      })
      it('should add XML namespace attributes', () => {
        expect(changeInstance.value).toHaveProperty(
          `${XML_ATTRIBUTE_PREFIX}xmlns:xsd`,
          'http://www.w3.org/2001/XMLSchema',
        )
        expect(changeInstance.value).toHaveProperty(
          `${XML_ATTRIBUTE_PREFIX}xmlns:xsi`,
          'http://www.w3.org/2001/XMLSchema-instance',
        )
      })
    })

    describe('onDeploy', () => {
      let changeInstance: MetadataInstanceElement
      beforeAll(async () => {
        changeInstance = createCustomMetadataInstanceFromService({
          fullName: 'MDType.InstWithNullValue',
          values: [
            { field: 'Field__c', value: { 'attr_xsi:type': 'xsd:double', '#text': '10.0' } },
            { field: 'Field2__c', value: { 'attr_xsi:nil': 'true' } },
          ],
        })
        await filter.onDeploy([toChange({ after: changeInstance })])
      })
      it('should return all values to their original nacl form', () => {
        expect(changeInstance.value).toEqual(naclValues)
      })
    })
  })
})
