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
import {
  Change,
  Element,
  ElemID,
  getChangeData,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { mockTypes, mockInstances } from '../mock_elements'
import { defaultFilterContext } from '../utils'
import makeFilter, {
  ServiceMDTRecordValue,
} from '../../src/filters/custom_metadata'
import {
  MetadataInstanceElement,
  createInstanceElement,
  MetadataValues,
  Types,
  apiName,
} from '../../src/transformers/transformer'
import {
  API_NAME,
  CUSTOM_METADATA,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  SALESFORCE,
  XML_ATTRIBUTE_PREFIX,
} from '../../src/constants'
import { FilterWith } from './mocks'

const { awu } = collections.asynciterable

type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
describe('CustomMetadata filter', () => {
  const CUSTOM_METADATA_RECORD_TYPE_NAME = 'MDType__mdt'
  const customMetadataRecordType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_RECORD_TYPE_NAME),
    fields: {
      longTextArea__c: { refType: Types.primitiveDataTypes.LongTextArea },
      metadataRelationship__c: {
        refType: Types.primitiveDataTypes.MetadataRelationship,
      },
      checkbox__c: { refType: Types.primitiveDataTypes.Checkbox },
      date__c: { refType: Types.primitiveDataTypes.Date },
      dateTime__c: { refType: Types.primitiveDataTypes.DateTime },
      email__c: { refType: Types.primitiveDataTypes.Email },
      number__c: { refType: Types.primitiveDataTypes.Number },
      percent__c: { refType: Types.primitiveDataTypes.Percent },
      phone__c: { refType: Types.primitiveDataTypes.Phone },
      picklist__c: { refType: Types.primitiveDataTypes.Picklist },
      text__c: { refType: Types.primitiveDataTypes.Text },
      textArea__c: { refType: Types.primitiveDataTypes.TextArea },
      url__c: { refType: Types.primitiveDataTypes.Url },
    },
    annotations: {
      [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
      [METADATA_TYPE]: CUSTOM_METADATA,
    },
  })
  const createCustomMetadataInstanceFromService = (
    values: ServiceMDTRecordValue & MetadataValues,
  ): MetadataInstanceElement =>
    createInstanceElement(
      {
        ...values,
        'attr_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      },
      mockTypes.CustomMetadata,
    )

  const getInstanceByApiName = (
    elements: Element[],
    instanceApiName: string,
  ): Promise<MetadataInstanceElement> =>
    awu(elements).find(
      async (e) => (await apiName(e)) === instanceApiName,
    ) as Promise<MetadataInstanceElement>

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
      const SINGLE_VALUE_INSTANCE_NAME = 'MDType.InstWithSingleValue'
      const NULL_VALUE_INSTANCE_NAME = 'MDType.InstWithNullValue'

      let singleValueInstance: MetadataInstanceElement
      let nullValueInstance: MetadataInstanceElement

      beforeEach(async () => {
        singleValueInstance = createCustomMetadataInstanceFromService({
          [INSTANCE_FULL_NAME_FIELD]: SINGLE_VALUE_INSTANCE_NAME,
          values: {
            field: 'text__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
        })
        nullValueInstance = createCustomMetadataInstanceFromService({
          [INSTANCE_FULL_NAME_FIELD]: NULL_VALUE_INSTANCE_NAME,
          values: [
            {
              field: 'text__c',
              value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
            },
            { field: 'number__c', value: { 'attr_xsi:nil': 'true' } },
          ],
        })
        const elements = [
          mockTypes.CustomMetadata,
          singleValueInstance,
          nullValueInstance,
          customMetadataRecordType,
        ]
        await filter.onFetch(elements)
        singleValueInstance = await getInstanceByApiName(
          elements,
          SINGLE_VALUE_INSTANCE_NAME,
        )
        nullValueInstance = await getInstanceByApiName(
          elements,
          NULL_VALUE_INSTANCE_NAME,
        )
      })
      it('should create fields from "values"', () => {
        expect(singleValueInstance.value.values).toBeUndefined()
        expect(singleValueInstance.value.text__c).toEqual('value')
      })
      it('should not convert null values to fields', async () => {
        expect(nullValueInstance.value.values).toBeUndefined()
        expect(nullValueInstance.value.text__c).toEqual('value')
        expect(nullValueInstance.value.number__c).toBeUndefined()
      })
      it('should remove XML namespace attributes', () => {
        expect(nullValueInstance.value).not.toContainKey(
          expect.stringMatching(new RegExp(`^${XML_ATTRIBUTE_PREFIX}.*`)),
        )
      })
      it('should convert to the correct type', async () => {
        const instanceType = await singleValueInstance.getType()
        expect(instanceType).toEqual(customMetadataRecordType)
      })
    })
    describe('when CustomMetadataRecordType was not retrieved in partial fetch', () => {
      const SINGLE_VALUE_INSTANCE_NAME = 'MDType.InstWithSingleValue'
      const NULL_VALUE_INSTANCE_NAME = 'MDType.InstWithNullValue'

      let singleValueInstance: MetadataInstanceElement
      let nullValueInstance: MetadataInstanceElement

      beforeEach(async () => {
        singleValueInstance = createCustomMetadataInstanceFromService({
          [INSTANCE_FULL_NAME_FIELD]: SINGLE_VALUE_INSTANCE_NAME,
          values: {
            field: 'text__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
        })
        nullValueInstance = createCustomMetadataInstanceFromService({
          [INSTANCE_FULL_NAME_FIELD]: NULL_VALUE_INSTANCE_NAME,
          values: [
            {
              field: 'text__c',
              value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
            },
            { field: 'number__c', value: { 'attr_xsi:nil': 'true' } },
          ],
        })
        const elements = [
          mockTypes.CustomMetadata,
          singleValueInstance,
          nullValueInstance,
        ]
        filter = makeFilter({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { target: [CUSTOM_METADATA] },
            }),
            elementsSource: buildElementsSourceFromElements([
              customMetadataRecordType,
            ]),
          },
        }) as FilterType
        await filter.onFetch(elements)
        singleValueInstance = await getInstanceByApiName(
          elements,
          SINGLE_VALUE_INSTANCE_NAME,
        )
        nullValueInstance = await getInstanceByApiName(
          elements,
          NULL_VALUE_INSTANCE_NAME,
        )
      })
      it('should create fields from "values"', () => {
        expect(singleValueInstance.value.values).toBeUndefined()
        expect(singleValueInstance.value.text__c).toEqual('value')
      })
      it('should not convert null values to fields', async () => {
        expect(nullValueInstance.value.values).toBeUndefined()
        expect(nullValueInstance.value.text__c).toEqual('value')
        expect(nullValueInstance.value.number__c).toBeUndefined()
      })
      it('should remove XML namespace attributes', () => {
        expect(nullValueInstance.value).not.toContainKey(
          expect.stringMatching(new RegExp(`^${XML_ATTRIBUTE_PREFIX}.*`)),
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
      longTextArea__c: 'value',
      metadataRelationship__c: 'value',
      checkbox__c: true,
      date__c: '2022-10-12',
      dateTime__c: '2022-10-12T12:21:00.000Z',
      email__c: 'test@user.com',
      // number__c is not defined in order to cover null value handling
      percent__c: 23,
      phone__c: '972547771234',
      picklist__c: '1',
      text__c: 'value',
      textArea__c: 'value',
      url__c: 'https://www.google.com',
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
        const initialInstance = createInstanceElement(
          naclValues,
          customMetadataRecordType,
        )
        initialChange = toChange({ after: initialInstance })
        const changes = [initialChange]
        await filter.preDeploy(changes)
        afterPreDeployInstance = getChangeData(
          changes[0],
        ) as MetadataInstanceElement
        const onDeployChanges = [toChange({ after: afterPreDeployInstance })]
        await filter.onDeploy(onDeployChanges)
        // eslint-disable-next-line prefer-destructuring
        afterOnDeployChange = onDeployChanges[0]
      })
      it('should create "values" from custom fields', () => {
        expect(afterPreDeployInstance.value.values).toEqual([
          {
            field: 'longTextArea__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
          {
            field: 'metadataRelationship__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
          {
            field: 'checkbox__c',
            value: { 'attr_xsi:type': 'xsd:boolean', '#text': true },
          },
          {
            field: 'date__c',
            value: { 'attr_xsi:type': 'xsd:date', '#text': '2022-10-12' },
          },
          {
            field: 'dateTime__c',
            value: {
              'attr_xsi:type': 'xsd:dateTime',
              '#text': '2022-10-12T12:21:00.000Z',
            },
          },
          {
            field: 'email__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'test@user.com' },
          },
          { field: 'number__c', value: { 'attr_xsi:nil': 'true' } }, // null value handling
          {
            field: 'percent__c',
            value: { 'attr_xsi:type': 'xsd:double', '#text': 23 },
          },
          {
            field: 'phone__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': '972547771234' },
          },
          {
            field: 'picklist__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': '1' },
          },
          {
            field: 'text__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
          {
            field: 'textArea__c',
            value: { 'attr_xsi:type': 'xsd:string', '#text': 'value' },
          },
          {
            field: 'url__c',
            value: {
              'attr_xsi:type': 'xsd:string',
              '#text': 'https://www.google.com',
            },
          },
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
