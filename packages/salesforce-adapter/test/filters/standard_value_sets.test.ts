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
  ObjectType, ElemID, Element, InstanceElement, Field, ReferenceExpression, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { MetadataInfo } from 'jsforce'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import {
  makeFilter, STANDARD_VALUE_SET, STANDARD_VALUE,
} from '../../src/filters/standard_value_sets'
import SalesforceClient from '../../src/client/client'
import { Types } from '../../src/transformers/transformer'
import { extractFullNamesFromValueList } from '../../src/filters/utils'

const createStandardValueSetMetadataInfo = (name: string, values: string[]): MetadataInfo =>
  ({
    fullName: name,
    sorted: false,
    standardValue: values.map(v => (
      {
        fullName: v,
        default: 'false',
        label: v,
      })),
  } as MetadataInfo)


const createPicklistObjectType = (
  mockElemID: ElemID,
  apiName: string,
  pickListValues: string[],
  isMultiPicklist = false
): ObjectType => new ObjectType({
  elemID: mockElemID,
  fields: {
    state: new Field(
      mockElemID,
      'simps',
      isMultiPicklist
        ? Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.MULTIPICKLIST]
        : Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST], {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.API_NAME]: apiName,
        label: 'test label',
        [constants.FIELD_ANNOTATIONS.VALUE_SET]: pickListValues.map(val => ({
          [constants.CUSTOM_VALUE.FULL_NAME]: val,
          [constants.CUSTOM_VALUE.LABEL]: val,
          [constants.CUSTOM_VALUE.DEFAULT]: val === 'Bart',
        })),
      }
    ),
  },
  annotations: {
    [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
  },
})

/* eslint-disable jest/no-focused-tests */
describe('Standard Value Sets filter', () => {
  type FilterType = FilterWith<'onFetch'>
  const { client } = mockClient()
  const mockSVSType = new ObjectType({
    annotationTypes: {},
    elemID: new ElemID(constants.SALESFORCE, 'standard_value_set'),
  })
  mockSVSType.annotations[constants.METADATA_TYPE] = STANDARD_VALUE_SET


  const filterCreator = (sfClient: SalesforceClient): FilterType =>
    makeFilter(new Set<string>(['Simpsons', 'Numbers']))({ client: sfClient }) as FilterType

  let filter: FilterType

  beforeEach(() => {
    client.readMetadata = jest.fn().mockImplementationOnce(() =>
      [createStandardValueSetMetadataInfo('Simpsons', ['Bart', 'Homer', 'Lisa']),
        createStandardValueSetMetadataInfo('Numbers', ['One', 'Two', 'Three'])])
    filter = filterCreator(client)
  })


  it('should do nothing if no standard value set element was found', async () => {
    const elements: Element[] = []
    await filter.onFetch(elements)
    expect(client.readMetadata).toHaveBeenCalledTimes(0)
    expect(elements.length).toBe(0)
  })

  it('should add standard value set instances', async () => {
    const elements: Element[] = [mockSVSType.clone()]
    await filter.onFetch(elements)
    expect(client.readMetadata).toHaveBeenCalledTimes(1)
    expect(elements.length).toBe(3)
    const simpsonsSvs = elements[1]
    expect(simpsonsSvs.elemID).toEqual(mockSVSType.elemID.createNestedID('instance', 'Simpsons'))
    expect(simpsonsSvs.path)
      .toEqual([constants.SALESFORCE, constants.RECORDS_PATH, 'standard_value_set', 'Simpsons'])
    expect(extractFullNamesFromValueList((simpsonsSvs as InstanceElement).value[STANDARD_VALUE])).toEqual(['Bart', 'Homer', 'Lisa'])
    const numbersSvs = elements[2]
    expect(numbersSvs.elemID).toEqual(mockSVSType.elemID.createNestedID('instance', 'Numbers'))
    expect(numbersSvs.path)
      .toEqual([constants.SALESFORCE, constants.RECORDS_PATH, 'standard_value_set', 'Numbers'])
    expect(extractFullNamesFromValueList((numbersSvs as InstanceElement).value[STANDARD_VALUE])).toEqual(['One', 'Two', 'Three'])
  })
  it('should replace value list with references for standard picklist fields', async () => {
    const apiName = 'simps'
    const pickListValues = ['Bart', 'Homer', 'Lisa']
    const mockElemID = new ElemID(constants.SALESFORCE, 'test')
    const typeElement = createPicklistObjectType(mockElemID, apiName, pickListValues)
    const elements: Element[] = [mockSVSType.clone(), typeElement]
    await filter.onFetch(elements)
    expect(elements.length).toBe(4)
    const simpsonsSvs = elements[2]
    expect(typeElement.fields.state.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
      .toEqual(new ReferenceExpression(simpsonsSvs.elemID.createNestedID(STANDARD_VALUE)))
  })

  it('should replace value list with references for standard multipicklist fields', async () => {
    const apiName = 'simps'
    const pickListValues = ['Bart', 'Homer', 'Lisa']
    const mockElemID = new ElemID(constants.SALESFORCE, 'test')
    const typeElement = createPicklistObjectType(mockElemID, apiName, pickListValues, true)
    const elements: Element[] = [mockSVSType.clone(), typeElement]
    await filter.onFetch(elements)
    expect(elements.length).toBe(4)
    const simpsonsSvs = elements[2]
    expect(typeElement.fields.state.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
      .toEqual(new ReferenceExpression(simpsonsSvs.elemID.createNestedID(STANDARD_VALUE)))
  })

  it('should not replace value list with references for custom picklist fields', async () => {
    const apiName = 'simpsy__c'
    const pickListValues = ['Bart', 'Homer', 'Lisa']
    const mockElemID = new ElemID(constants.SALESFORCE, 'test')
    const typeElement = createPicklistObjectType(mockElemID, apiName, pickListValues)
    const elements: Element[] = [mockSVSType.clone(), typeElement]
    await filter.onFetch(elements)
    expect(elements.length).toBe(4)
    expect(extractFullNamesFromValueList(typeElement.fields.state
      .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])).toEqual(pickListValues)
  })

  it('should not replace value list with references for standard picklist fields if svs with values not found', async () => {
    const apiName = 'simps'
    const pickListValues = ['Marge', 'Homer', 'Lisa']
    const mockElemID = new ElemID(constants.SALESFORCE, 'test')
    const typeElement = createPicklistObjectType(mockElemID, apiName, pickListValues)
    const elements: Element[] = [mockSVSType.clone(), typeElement]
    await filter.onFetch(elements)
    expect(elements.length).toBe(4)
    expect(extractFullNamesFromValueList(typeElement.fields.state
      .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])).toEqual(pickListValues)
  })
})
