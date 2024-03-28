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
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  Field,
  getAllChangeData,
  InstanceElement,
  isField,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { MetadataInfo } from '@salto-io/jsforce'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import * as constants from '../../src/constants'
import {
  API_NAME,
  INSTANCE_FULL_NAME_FIELD,
  VALUE_SET_FIELDS,
} from '../../src/constants'
import mockClient from '../client'
import {
  makeFilter,
  STANDARD_VALUE,
  STANDARD_VALUE_SET,
} from '../../src/filters/standard_value_sets'
import SalesforceClient from '../../src/client/client'
import {
  createInstanceElement,
  Types,
} from '../../src/transformers/transformer'
import { extractFullNamesFromValueList } from '../../src/filters/utils'
import { defaultFilterContext } from '../utils'
import { mockInstances, mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { buildMetadataQueryForFetchWithChangesDetection } from '../../src/fetch_profile/metadata_query'
import { LastChangeDateOfTypesWithNestedInstances } from '../../src/types'

const createStandardValueSetMetadataInfo = (
  name: string,
  values: string[],
): MetadataInfo =>
  ({
    fullName: name,
    sorted: false,
    standardValue: values.map((v) => ({
      fullName: v,
      default: 'false',
      label: v,
    })),
  }) as MetadataInfo

const isStringArray = (val: unknown): val is string[] =>
  _.isArray(val) && val.every(_.isString)

const createPicklistObjectType = (
  mockElemID: ElemID,
  apiName: string,
  pickListValues:
    | string[]
    | { fullName: string; default: boolean; label: string }[],
  isMultiPicklist = false,
): ObjectType =>
  new ObjectType({
    elemID: mockElemID,
    fields: {
      state: {
        refType: isMultiPicklist
          ? Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.MULTIPICKLIST]
          : Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.API_NAME]: apiName,
          label: 'test label',
          [constants.FIELD_ANNOTATIONS.VALUE_SET]: isStringArray(pickListValues)
            ? pickListValues.map((val) => ({
                [constants.CUSTOM_VALUE.FULL_NAME]: val,
                [constants.CUSTOM_VALUE.LABEL]: val,
                [constants.CUSTOM_VALUE.DEFAULT]: val === 'Bart',
              }))
            : pickListValues,
        },
      },
    },
    annotations: {
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })

/* eslint-disable jest/no-focused-tests */
describe('Standard Value Sets filter', () => {
  type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  const { client } = mockClient()
  const mockSVSType = new ObjectType({
    annotationRefsOrTypes: {},
    elemID: new ElemID(constants.SALESFORCE, 'standard_value_set'),
  })
  mockSVSType.annotations[constants.METADATA_TYPE] = STANDARD_VALUE_SET

  const SVS_INSTANCE_STANDARD_VALUE = [
    {
      fullName: 'Obsolete',
      default: false,
      label: 'Obsolete',
    },
    {
      fullName: 'Purchased',
      default: false,
      label: 'Purchased',
    },
  ]

  const svsInstanceFromSource = createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: 'FromSource',
      sorted: false,
      standardValue: SVS_INSTANCE_STANDARD_VALUE,
    },
    mockSVSType,
  )

  const filterCreator = async (
    sfClient: SalesforceClient,
    isFetchWithChangesDetection = false,
  ): Promise<FilterType> => {
    const elementsSource = buildElementsSourceFromElements([
      svsInstanceFromSource,
      mockInstances().ChangedAtSingleton,
    ])
    const metadataQuery = isFetchWithChangesDetection
      ? await buildMetadataQueryForFetchWithChangesDetection({
          fetchParams: {},
          elementsSource,
          lastChangeDateOfTypesWithNestedInstances:
            {} as unknown as LastChangeDateOfTypesWithNestedInstances,
          customObjectsWithDeletedFields: new Set(),
        })
      : defaultFilterContext.fetchProfile.metadataQuery
    const fetchProfile = buildFetchProfile({ fetchParams: {}, metadataQuery })
    return makeFilter(new Set<string>(['Simpsons', 'Numbers']))({
      client: sfClient,
      config: { ...defaultFilterContext, fetchProfile, elementsSource },
    }) as FilterType
  }

  let filter: FilterType

  beforeEach(async () => {
    client.readMetadata = jest.fn().mockImplementationOnce(() => ({
      result: [
        createStandardValueSetMetadataInfo('Simpsons', [
          'Bart',
          'Homer',
          'Lisa',
        ]),
        createStandardValueSetMetadataInfo('Numbers', ['One', 'Two', 'Three']),
      ],
    }))
    filter = await filterCreator(client)
  })

  describe('onFetch', () => {
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
      expect(simpsonsSvs.elemID).toEqual(
        mockSVSType.elemID.createNestedID('instance', 'Simpsons'),
      )
      expect(simpsonsSvs.path).toEqual([
        constants.SALESFORCE,
        constants.RECORDS_PATH,
        'standard_value_set',
        'Simpsons',
      ])
      expect(
        extractFullNamesFromValueList(
          (simpsonsSvs as InstanceElement).value[STANDARD_VALUE],
        ),
      ).toEqual(['Bart', 'Homer', 'Lisa'])
      const numbersSvs = elements[2]
      expect(numbersSvs.elemID).toEqual(
        mockSVSType.elemID.createNestedID('instance', 'Numbers'),
      )
      expect(numbersSvs.path).toEqual([
        constants.SALESFORCE,
        constants.RECORDS_PATH,
        'standard_value_set',
        'Numbers',
      ])
      expect(
        extractFullNamesFromValueList(
          (numbersSvs as InstanceElement).value[STANDARD_VALUE],
        ),
      ).toEqual(['One', 'Two', 'Three'])
    })
    it('should replace value list with references for standard picklist fields', async () => {
      const apiName = 'simps'
      const pickListValues = ['Bart', 'Homer', 'Lisa']
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const typeElement = createPicklistObjectType(
        mockElemID,
        apiName,
        pickListValues,
      )
      const elements: Element[] = [mockSVSType.clone(), typeElement]
      await filter.onFetch(elements)
      expect(elements.length).toBe(4)
      const simpsonsSvs = elements[2]
      expect(
        typeElement.fields.state.annotations[
          constants.VALUE_SET_FIELDS.VALUE_SET_NAME
        ],
      ).toEqual(new ReferenceExpression(simpsonsSvs.elemID))
    })

    it('should replace value list with references for standard multipicklist fields', async () => {
      const apiName = 'simps'
      const pickListValues = ['Bart', 'Homer', 'Lisa']
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const typeElement = createPicklistObjectType(
        mockElemID,
        apiName,
        pickListValues,
        true,
      )
      const elements: Element[] = [mockSVSType.clone(), typeElement]
      await filter.onFetch(elements)
      expect(elements.length).toBe(4)
      const simpsonsSvs = elements[2]
      expect(
        typeElement.fields.state.annotations[
          constants.VALUE_SET_FIELDS.VALUE_SET_NAME
        ],
      ).toEqual(new ReferenceExpression(simpsonsSvs.elemID))
    })

    it('should not replace value list with references for custom picklist fields', async () => {
      const apiName = 'simpsy__c'
      const pickListValues = ['Bart', 'Homer', 'Lisa']
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const typeElement = createPicklistObjectType(
        mockElemID,
        apiName,
        pickListValues,
      )
      const elements: Element[] = [mockSVSType.clone(), typeElement]
      await filter.onFetch(elements)
      expect(elements.length).toBe(4)
      expect(
        extractFullNamesFromValueList(
          typeElement.fields.state.annotations[
            constants.FIELD_ANNOTATIONS.VALUE_SET
          ],
        ),
      ).toEqual(pickListValues)
    })

    it('should not replace value list with references for standard picklist fields if svs with values not found', async () => {
      const apiName = 'simps'
      const pickListValues = ['Marge', 'Homer', 'Lisa']
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const typeElement = createPicklistObjectType(
        mockElemID,
        apiName,
        pickListValues,
      )
      const elements: Element[] = [mockSVSType.clone(), typeElement]
      await filter.onFetch(elements)
      expect(elements.length).toBe(4)
      expect(
        extractFullNamesFromValueList(
          typeElement.fields.state.annotations[
            constants.FIELD_ANNOTATIONS.VALUE_SET
          ],
        ),
      ).toEqual(pickListValues)
    })

    describe('when is fetch with changes detection mode', () => {
      beforeEach(async () => {
        filter = await filterCreator(client, true)
      })
      it('should create correct reference on a Field', async () => {
        const objectType = createPicklistObjectType(
          new ElemID(constants.SALESFORCE, 'Test__c'),
          'StandardField',
          SVS_INSTANCE_STANDARD_VALUE,
        )
        const elements = [mockSVSType.clone(), objectType]
        await filter.onFetch(elements)
        const field = objectType.fields.state as Field
        expect(field).toSatisfy(isField)
        expect(
          field.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME],
        ).toEqual(new ReferenceExpression(svsInstanceFromSource.elemID))
        // No reason to append a non modified SVS instance to the elements
        expect(elements).not.toContain(svsInstanceFromSource)
      })
    })
  })

  describe('deploy flow', () => {
    let originalChange: Change<Field>
    let afterPreDeployChanges: Change<Field>[]
    let afterOnDeployChanges: Change<Field>[]

    beforeEach(async () => {
      const beforePicklistStandardField = new Field(
        mockTypes.Profile,
        'StandardPicklist',
        Types.primitiveDataTypes.Picklist,
        {
          [API_NAME]: 'Profile.StandardPicklist',
          [VALUE_SET_FIELDS.VALUE_SET_NAME]: 'StandardPicklistValueSet',
          description: 'before',
        },
      )
      const afterPicklistStandardField = beforePicklistStandardField.clone({
        ...beforePicklistStandardField.annotations,
        description: 'after',
      })
      originalChange = toChange({
        before: beforePicklistStandardField,
        after: afterPicklistStandardField,
      })
      afterPreDeployChanges = [originalChange]
      await filter.preDeploy(afterPreDeployChanges)
      afterOnDeployChanges = [...afterPreDeployChanges]
      await filter.onDeploy(afterOnDeployChanges)
    })
    it('should omit the valueSetName annotation on preDeploy', () => {
      expect(afterPreDeployChanges).toHaveLength(1)
      expect(getAllChangeData(afterPreDeployChanges[0])).toSatisfyAll((field) =>
        _.isUndefined(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]),
      )
    })
    it('should restore to original change on onDeploy', () => {
      expect(afterOnDeployChanges).toEqual([originalChange])
    })
  })
})
