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
import _ from 'lodash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  Element,
  ElemID,
  FetchResult,
  FieldDefinition,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  ReadOnlyElementsSource,
  ReferenceExpression,
  SaltoError,
  ServiceIds,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import {
  ConfigChangeSuggestion,
  FetchParameters,
  FetchProfile,
  isDataManagementConfigSuggestions,
  SaltoAliasSettings,
} from '../../src/types'
import {
  buildSelectQueries,
  getFieldNamesForQuery,
  QueryOperator,
  SoqlQuery,
} from '../../src/filters/utils'
import { FilterResult } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import filterCreator from '../../src/filters/custom_objects_instances'
import mockAdapter from '../adapter'
import {
  API_NAME,
  CHANGED_AT_SINGLETON,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  DATA_INSTANCES_CHANGED_AT_MAGIC,
  DETECTS_PARENTS_INDICATOR,
  FIELD_ANNOTATIONS,
  INSTALLED_PACKAGES_PATH,
  LABEL,
  METADATA_TYPE,
  OBJECTS_PATH,
  RECORDS_PATH,
  SALESFORCE,
  SoqlQueryLimits,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import {
  defaultFilterContext,
  emptyLastChangeDateOfTypesWithNestedInstances,
} from '../utils'
import { mockInstances, mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { SalesforceRecord } from '../../src/client/types'
import {
  buildMetadataQuery,
  buildMetadataQueryForFetchWithChangesDetection,
} from '../../src/fetch_profile/metadata_query'

const { awu } = collections.asynciterable

jest.mock('../../src/constants', () => ({
  ...jest.requireActual<{}>('../../src/constants'),
  MAX_IDS_PER_INSTANCES_QUERY: 2,
}))

const stringType = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'string'),
  primitive: PrimitiveTypes.STRING,
})

const MANAGED_BY_SALTO_FIELD_NAME = 'ManagedBySalto__c'

const createCustomObject = (
  name: string,
  additionalFields?: Record<string, FieldDefinition>,
): ObjectType => {
  const basicFields = {
    Id: {
      refType: stringType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
        [LABEL]: 'Id',
        [API_NAME]: `${name}.Id`,
      },
    },
    Name: {
      refType: stringType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
        [LABEL]: 'description label',
        [API_NAME]: `${name}.Name`,
      },
    },
    TestField: {
      refType: stringType,
      annotations: {
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
        [LABEL]: 'Test field',
        [API_NAME]: `${name}.TestField`,
      },
    },
  }
  const obj = new ObjectType({
    elemID: new ElemID(SALESFORCE, name),
    annotations: {
      [API_NAME]: name,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
    fields: additionalFields
      ? Object.assign(basicFields, additionalFields)
      : basicFields,
  })
  obj.path = [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
  return obj
}

/* eslint-disable camelcase */
describe('Custom Object Instances filter', () => {
  let connection: Connection
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const createNamespaceRegexFromString = (namespace: string): string =>
    `${namespace}__.*`

  const NAME_FROM_GET_ELEM_ID = 'getElemIDPrefix'
  const mockGetElemIdFunc = (
    adapterName: string,
    _serviceIds: ServiceIds,
    name: string,
  ): ElemID => new ElemID(adapterName, `${NAME_FROM_GET_ELEM_ID}${name}`)

  const TestCustomRecords: SalesforceRecord[] = [
    {
      attributes: {
        type: 'Test',
      },
      Id: 'abcdefg',
      OtherAddress: {
        city: 'city',
        counry: 'country',
      },
      Name: 'Name',
      FirstName: 'First',
      LastName: 'Last',
      TestField: 'Test',
      Parent: 'hijklmn',
      Grandparent: 'hijklmn',
      Pricebook2Id: 'hijklmn',
      SBQQ__Location__c: 'Quote',
      SBQQ__DisplayOrder__c: 2,
      ProductCode: null,
    },
    {
      attributes: {
        type: 'Test',
      },
      Id: 'hijklmn',
      OtherAddress: {
        city: 'citizen',
        counry: 'countrizen',
      },
      Name: 'Namizen',
      FirstName: 'Firstizen',
      LastName: 'Lastizen',
      TestField: 'testizen',
      Parent: 'abcdefg',
      Grandparent: 'abcdefg',
      Pricebook2Id: 'abcdefg',
      SBQQ__Location__c: 'Quote',
      SBQQ__DisplayOrder__c: 3,
    },
  ]

  let basicQueryImplementation: jest.Mock

  const testNamespace = 'TestNamespace'
  const nameBasedNamespace = 'NameBasedNamespace'
  const refFromNamespace = 'RefFromNamespace'
  const includeObjectName = 'IncludeThisObject'
  const excludeObjectName = 'TestNamespace__ExcludeMe__c'
  const excludeOverrideObjectName = 'ExcludeOverrideObject'
  const refToObjectName = 'RefTo'
  const refToFromNamespaceObjectName = 'RefFromNamespace__RefTo__c'
  const refFromAndToObjectName = 'RefFromAndTo'
  const emptyRefToObjectName = 'EmptyRefTo'
  const notInNamespaceName = 'NotInNamespace__c'

  const createMockQueryImplementation =
    (testRecords: SalesforceRecord[], strict: boolean) =>
    async (soql: string): Promise<Record<string, unknown>> => {
      let records = testRecords
      if (strict) {
        if (soql.includes(`${MANAGED_BY_SALTO_FIELD_NAME}=TRUE`)) {
          records = testRecords.filter(
            (record) => record[MANAGED_BY_SALTO_FIELD_NAME] === true,
          )
        }
        const fromClause = soql.match(/FROM\s*(\w+,?\s*)+(?:WHERE|$)/)
        const idClause = soql.match(/Id IN\s*\(([^)]+)\)/)
        if (idClause) {
          const idsToFind = idClause[1]
            .replace(/'/g, '')
            .replace(/\s+/g, '')
            .split(',')
          records = records.filter((record) => idsToFind.includes(record.Id))
        }
        if (fromClause) {
          const typesToFind = fromClause[1].replace(/\s+/g, '').split(',')
          records = records.filter((record) =>
            typesToFind.includes(record.attributes.type),
          )
        }
      }
      return {
        totalSize: records.length,
        done: true,
        records,
      }
    }

  const setMockQueryResults = (
    testRecords: SalesforceRecord[],
    strict = true,
  ): void => {
    basicQueryImplementation = jest
      .fn()
      .mockImplementation(createMockQueryImplementation(testRecords, strict))
    connection.query = basicQueryImplementation
  }

  beforeEach(async () => {
    ;({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    setMockQueryResults(TestCustomRecords, false)
  })

  type TestFetchProfileParams = {
    typeName: string
    included: boolean
    excluded: boolean
    allowRef: boolean
  }
  const buildTestFetchProfile = async ({
    types,
    omittedFields = [],
    elementsSourceForQuickFetch,
  }: {
    types: TestFetchProfileParams[]
    omittedFields?: string[]
    elementsSourceForQuickFetch?: ReadOnlyElementsSource
  }): Promise<FetchProfile> => {
    const fetchProfileParams: FetchParameters = {
      data: {
        includeObjects: types
          .filter((typeParams) => typeParams.included)
          .map((typeParams) => typeParams.typeName),
        excludeObjects: types
          .filter((typeParams) => typeParams.excluded)
          .map((typeParams) => typeParams.typeName),
        allowReferenceTo: types
          .filter((typeParams) => typeParams.allowRef)
          .map((typeParams) => typeParams.typeName),
        saltoIDSettings: {
          defaultIdFields: ['Id'],
        },
        saltoManagementFieldSettings: {
          defaultFieldName: MANAGED_BY_SALTO_FIELD_NAME,
        },
        ...(omittedFields ? { omittedFields } : {}),
      },
    }
    const metadataQuery = elementsSourceForQuickFetch
      ? await buildMetadataQueryForFetchWithChangesDetection({
          fetchParams: fetchProfileParams,
          elementsSource: elementsSourceForQuickFetch,
          lastChangeDateOfTypesWithNestedInstances:
            emptyLastChangeDateOfTypesWithNestedInstances(),
        })
      : buildMetadataQuery({
          fetchParams: fetchProfileParams,
        })
    return buildFetchProfile({
      fetchParams: fetchProfileParams,
      metadataQuery,
    })
  }

  const getInstancesOfObjectType = (
    elementsToCheck: Element[],
    type: ObjectType,
  ): InstanceElement[] =>
    elementsToCheck.filter(
      (e) => isInstanceElement(e) && e.getTypeSync().isEqual(type),
    ) as InstanceElement[]

  describe('config interactions', () => {
    // ref: https://salto-io.atlassian.net/browse/SALTO-4579?focusedCommentId=97852
    const testTypeName = 'TestType'
    const refererTypeName = 'RefererType'
    const testInstanceId = 'some_id'
    const testType = createCustomObject(testTypeName, {
      [MANAGED_BY_SALTO_FIELD_NAME]: {
        refType: Types.primitiveDataTypes.Checkbox,
        annotations: {
          [LABEL]: 'Managed By Salto',
          [API_NAME]: MANAGED_BY_SALTO_FIELD_NAME,
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        },
      },
    })
    const refererType = createCustomObject(refererTypeName, {
      ReferenceField: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [LABEL]: 'Reference Origin',
          [API_NAME]: 'ReferenceField',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [testTypeName],
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        },
      },
    })
    const testRecords: SalesforceRecord[] = [
      {
        attributes: {
          type: testTypeName,
        },
        Id: testInstanceId,
        Name: 'Name',
      },
    ]
    let elements: Element[]

    describe.each([
      {
        // ref table row 1
        included: false,
        excluded: false,
        allowRef: false,
        managedBySalto: false,
      },
      {
        // ref table row 1 (alternative option)
        included: false,
        excluded: true,
        allowRef: false,
        managedBySalto: false,
      },
      {
        // ref table row 1 (alternative option)
        included: false,
        excluded: true,
        allowRef: false,
        managedBySalto: true,
      },
      {
        // ref table row 3
        included: false,
        excluded: false,
        allowRef: true,
        managedBySalto: false,
      },
      {
        // ref table row 6
        included: false,
        excluded: true,
        allowRef: true,
        managedBySalto: false,
      },
      {
        // ref table row 7
        included: false,
        excluded: true,
        allowRef: true,
        managedBySalto: true,
      },
      {
        // ref table row 9
        included: true,
        excluded: false,
        allowRef: false,
        managedBySalto: false,
      },
      {
        // ref table row 12
        included: true,
        excluded: false,
        allowRef: true,
        managedBySalto: false,
      },
      {
        // ref table row 14
        included: true,
        excluded: true,
        allowRef: false,
        managedBySalto: false,
      },
      {
        // ref table row 14 (alternative option)
        included: true,
        excluded: true,
        allowRef: false,
        managedBySalto: true,
      },
      {
        // ref table row 16
        included: true,
        excluded: true,
        allowRef: true,
        managedBySalto: false,
      },
    ])(
      'When there are no refs to the instance and inc=$included exc=$excluded, ref=$allowRef',
      ({ included, excluded, allowRef, managedBySalto }) => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: await buildTestFetchProfile({
                types: [
                  { typeName: testTypeName, included, excluded, allowRef },
                ],
              }),
            },
          }) as FilterType

          elements = [testType]

          testRecords.forEach((record) => {
            record[MANAGED_BY_SALTO_FIELD_NAME] = managedBySalto
          })
          setMockQueryResults(testRecords)

          await filter.onFetch(elements)
        })
        it('should not fetch the instance', () => {
          expect(
            elements.filter((e) => e.annotations[API_NAME] === testInstanceId),
          ).toBeEmpty()
        })
      },
    )

    describe.each([
      {
        // ref table row 4
        included: false,
        excluded: false,
        allowRef: true,
      },
      {
        // ref table row 7
        included: false,
        excluded: true,
        allowRef: true,
      },
      {
        // ref table row 10
        included: true,
        excluded: false,
        allowRef: false,
      },
      {
        // ref table row 13
        included: true,
        excluded: false,
        allowRef: true,
      },
      {
        // ref table row 17
        included: true,
        excluded: true,
        allowRef: true,
      },
    ])(
      'When there are no refs to an instance that is managed by Salto and inc=$included, exc=$excluded, ref=$allowRef',
      ({ included, excluded, allowRef }) => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: await buildTestFetchProfile({
                types: [
                  { typeName: testTypeName, included, excluded, allowRef },
                ],
              }),
            },
          }) as FilterType

          elements = [testType]

          testRecords.forEach((record) => {
            record[MANAGED_BY_SALTO_FIELD_NAME] = true
          })
          setMockQueryResults(testRecords)

          await filter.onFetch(elements)
        })
        it('should fetch the instance', () => {
          const fetchedTestInstances = elements.filter(
            (e) =>
              isInstanceElement(e) &&
              e.value[CUSTOM_OBJECT_ID_FIELD] === testInstanceId,
          )
          expect(fetchedTestInstances).toHaveLength(1)
        })
      },
    )

    describe.each([
      {
        // ref table row 3
        excluded: false,
      },
      {
        // ref table row 6
        excluded: true,
      },
    ])(
      'When there are refs to the instance and exc=$excluded',
      ({ excluded }) => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: await buildTestFetchProfile({
                types: [
                  {
                    typeName: testTypeName,
                    included: false,
                    excluded,
                    allowRef: true,
                  },
                  {
                    typeName: refererTypeName,
                    included: true,
                    excluded: false,
                    allowRef: false,
                  },
                ],
              }),
            },
          }) as FilterType

          elements = [testType, refererType]

          testRecords.forEach((record) => {
            record[MANAGED_BY_SALTO_FIELD_NAME] = false
          })
          setMockQueryResults(testRecords)

          await filter.onFetch(elements)
        })
        it('should fetch the referred instance', () => {
          expect(
            elements.filter((e) => e.annotations[API_NAME] === testInstanceId),
          ).toBeEmpty()
        })
      },
    )
  })

  describe('Without includeObjects', () => {
    const excludeObject = createCustomObject(excludeObjectName)
    const refToObject = createCustomObject(refToObjectName)
    let elements: Element[]
    beforeEach(async () => {
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              data: {
                includeObjects: [],
                excludeObjects: [
                  '^TestNamespace__Exclude.*',
                  excludeOverrideObjectName,
                ],
                allowReferenceTo: [
                  '^RefFromNamespace__RefTo.*',
                  refToObjectName,
                  refFromAndToObjectName,
                  emptyRefToObjectName,
                ],
                saltoIDSettings: {
                  defaultIdFields: [],
                },
              },
            },
          }),
        },
      }) as FilterType
    })

    beforeEach(async () => {
      elements = [excludeObject, refToObject]
      await filter.onFetch(elements)
    })

    it('should not add any more elements', () => {
      expect(elements).toHaveLength(2)
    })

    it('should not effect the types', async () => {
      const excludedAfterFilter = elements.filter(
        (e) => e.annotations[API_NAME] === excludeObjectName,
      )[0]
      expect(excludedAfterFilter).toBeDefined()
      expect(excludedAfterFilter).toEqual(excludeObject)

      const refToAfterFilter = elements.filter(
        (e) => e.annotations[API_NAME] === refToObjectName,
      )[0]
      expect(refToAfterFilter).toBeDefined()
      expect(refToAfterFilter).toEqual(refToObject)
    })
  })

  describe('Without nameBasedID', () => {
    let fetchProfile: FetchProfile
    beforeEach(async () => {
      fetchProfile = buildFetchProfile({
        fetchParams: {
          data: {
            includeObjects: [
              createNamespaceRegexFromString(testNamespace),
              createNamespaceRegexFromString(refFromNamespace),
              includeObjectName,
              excludeOverrideObjectName,
              refFromAndToObjectName,
              notInNamespaceName,
            ],
            excludeObjects: [
              '^TestNamespace__Exclude.*',
              excludeOverrideObjectName,
            ],
            allowReferenceTo: [
              '^RefFromNamespace__RefTo.*',
              refToObjectName,
              refFromAndToObjectName,
              emptyRefToObjectName,
            ],
            saltoIDSettings: {
              defaultIdFields: ['Id'],
            },
          },
        },
      })
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile,
        },
      }) as FilterType
    })

    describe('Config filtering logic', () => {
      let elements: Element[]
      const notConfiguredObjName = 'NotInNameSpace'
      const notConfiguredObj = createCustomObject(notConfiguredObjName)

      const includedNamespaceObjName = `${testNamespace}__Included__c`
      const includedNameSpaceObj = createCustomObject(includedNamespaceObjName)

      const includedObject = createCustomObject(includeObjectName, {
        NonQueryable: {
          refType: stringType,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
            [LABEL]: 'Non-queryable field',
            [API_NAME]: 'NonQueryableField',
          },
        },
        HiddenNonQueryable: {
          refType: stringType,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
            [LABEL]: 'Hidden non-queryable field',
            [API_NAME]: 'HiddenNonQueryableField',
          },
        },
      })

      const refToObject = createCustomObject(refToObjectName, {
        NonQueryable: {
          refType: stringType,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
            [LABEL]: 'Non-queryable field',
            [API_NAME]: 'NonQueryableField',
          },
        },
      })
      const excludedObject = createCustomObject(excludeObjectName)
      const excludeOverrideObject = createCustomObject(
        excludeOverrideObjectName,
      )
      let fetchResult: FetchResult
      beforeEach(async () => {
        elements = [
          notConfiguredObj,
          includedNameSpaceObj,
          includedObject,
          excludedObject,
          excludeOverrideObject,
          refToObject,
        ]
      })

      describe('when an object has non-queryable fields', () => {
        describe('when warnings are enabled', () => {
          beforeEach(async () => {
            fetchResult = (await filter.onFetch(elements)) as FetchResult
          })
          it('should issue a message if there are instances of the object', () => {
            expect(fetchResult.errors).toEqual([
              {
                message:
                  expect.stringContaining(includeObjectName) &&
                  expect.stringContaining('NonQueryable'),
                severity: 'Info',
              },
            ])
            expect(fetchResult.errors?.[0].message).not.toInclude(
              'HiddenNonQueryable',
            )
          })
          it('should not issue a message if there are no instances of the object', () => {
            expect(fetchResult.errors).not.toIncludeAllPartialMembers([
              {
                message: expect.stringContaining(refToObjectName),
              },
            ])
          })
        })
        describe('when warnings are disabled', () => {
          let originalWarningsEnabled: FetchProfile['isWarningEnabled']
          beforeEach(async () => {
            originalWarningsEnabled = fetchProfile.isWarningEnabled
            fetchProfile.isWarningEnabled = () => false

            fetchResult = (await filter.onFetch(elements)) as FetchResult
          })
          afterEach(() => {
            fetchProfile.isWarningEnabled = originalWarningsEnabled
          })
          it('should not issue a message if there are instances of the object', () => {
            expect(fetchResult.errors).toBeEmpty()
          })
        })
      })
      describe('should add instances per configured object', () => {
        beforeEach(async () => {
          fetchResult = (await filter.onFetch(elements)) as FetchResult
        })

        it('should not fetch for non-configured objects', async () => {
          const notConfiguredObjInstances = getInstancesOfObjectType(
            elements,
            notConfiguredObj,
          )
          expect(notConfiguredObjInstances.length).toEqual(0)
        })

        it('should fetch for regex configured objects', () => {
          const includedNameSpaceObjInstances = getInstancesOfObjectType(
            elements,
            includedNameSpaceObj,
          )
          expect(includedNameSpaceObjInstances.length).toEqual(2)
        })

        it('should fetch for object included specifically configured', async () => {
          const includedObjectInstances = getInstancesOfObjectType(
            elements,
            includedObject,
          )
          expect(includedObjectInstances.length).toEqual(2)
        })

        it('should not fetch for object from a configured regex whose excluded specifically', async () => {
          const excludedObjectInstances = getInstancesOfObjectType(
            elements,
            excludedObject,
          )
          expect(excludedObjectInstances.length).toEqual(0)
        })

        it('should not fetch for object from a configured as excluded even if it was included by object', async () => {
          const excludeOverrideObjectInstances = getInstancesOfObjectType(
            elements,
            excludeOverrideObject,
          )
          expect(excludeOverrideObjectInstances.length).toEqual(0)
        })
      })

      it('should not change custom object elements', () => {
        const notConfiguredAfterFilter = elements.filter(
          (e) => e.annotations[API_NAME] === notConfiguredObjName,
        )[0]
        expect(notConfiguredAfterFilter).toBeDefined()
        expect(notConfiguredAfterFilter).toEqual(notConfiguredObj)

        const includedNameSpaceObjFilter = elements.filter(
          (e) => e.annotations[API_NAME] === includedNamespaceObjName,
        )[0]
        expect(includedNameSpaceObjFilter).toBeDefined()
        expect(includedNameSpaceObjFilter).toEqual(includedNameSpaceObj)

        const includedObjectFilter = elements.filter(
          (e) => e.annotations[API_NAME] === includeObjectName,
        )[0]
        expect(includedObjectFilter).toBeDefined()
        expect(includedObjectFilter).toEqual(includedObject)

        const excludedObjectFilter = elements.filter(
          (e) => e.annotations[API_NAME] === excludeObjectName,
        )[0]
        expect(excludedObjectFilter).toBeDefined()
        expect(excludedObjectFilter).toEqual(excludedObject)

        const excludeOverrideObjectFilter = elements.filter(
          (e) => e.annotations[API_NAME] === excludeOverrideObjectName,
        )[0]
        expect(excludeOverrideObjectFilter).toBeDefined()
        expect(excludeOverrideObjectFilter).toEqual(excludeOverrideObject)
      })
    })

    describe('When some CustomObjects fit the configured regex (namespace)', () => {
      let elements: Element[]
      const simpleName = `${testNamespace}__simple__c`
      const simpleObject = createCustomObject(simpleName)

      const noFieldsName = `${testNamespace}__noQueryablefields`
      const objWithNoFields = new ObjectType({
        elemID: new ElemID(SALESFORCE, noFieldsName),
        fields: {
          Id: {
            refType: stringType,
            annotations: {
              [API_NAME]: 'Id',
              [FIELD_ANNOTATIONS.QUERYABLE]: false,
            },
          },
          Other: {
            refType: stringType,
            annotations: {
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
              [API_NAME]: 'Other',
            },
          },
        },
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [API_NAME]: noFieldsName,
          [METADATA_TYPE]: CUSTOM_OBJECT,
        },
      })

      const withNameName = `${testNamespace}__withCompoundName__c`
      const objWithNameField = createCustomObject(withNameName)
      objWithNameField.fields.Name.refType = createRefToElmWithValue(
        Types.compoundDataTypes.Name,
      )

      const withAddressName = `${testNamespace}__withAddress__c`
      const objWithAddressField = createCustomObject(withAddressName, {
        OtherAddress: {
          refType: Types.compoundDataTypes.Address,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [LABEL]: 'Address',
            [API_NAME]: 'OtherAddress',
          },
        },
      })

      const objNotInNamespace = createCustomObject(notInNamespaceName)
      const expectedFirstInstanceName = `${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Id}`

      beforeEach(async () => {
        elements = [
          simpleObject,
          objWithNoFields,
          objWithNameField,
          objWithAddressField,
          objNotInNamespace,
        ]
        await filter.onFetch(elements)
      })

      it('should add instances per catched by regex object with fields', async () => {
        // 2 new instances per namespaced object because of TestCustomRecords's length
        expect(elements.length).toEqual(13)
        expect(
          (
            await awu(elements)
              .filter((e) => isInstanceElement(e))
              .toArray()
          ).length,
        ).toEqual(8)
      })

      describe('simple object', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = getInstancesOfObjectType(elements, simpleObject)
        })

        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(
            `SELECT Id,Name,TestField FROM ${simpleName}`,
          )
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual([
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            testNamespace,
            RECORDS_PATH,
            simpleName,
            expectedFirstInstanceName,
          ])
        })

        it('should create the instances with ElemID name according to the getElemID func', () => {
          expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
        })

        it('should create instance with values according to objects fields', () => {
          const { value } = instances[0]
          expect(value.Name).toEqual('Name')
          expect(value.TestField).toEqual('Test')
        })

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
        })
      })

      describe('object with no queryable fields', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = getInstancesOfObjectType(elements, objWithNoFields)
        })

        it('should not try to query for object', () => {
          expect(basicQueryImplementation).not.toHaveBeenCalledWith(
            expect.stringMatching(/.*noQueryablefields.*/),
          )
        })

        it('should not create any instances', () => {
          expect(instances.length).toEqual(0)
        })
      })

      describe('not in namespace object', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = getInstancesOfObjectType(elements, objNotInNamespace)
        })
        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual([
            SALESFORCE,
            RECORDS_PATH,
            notInNamespaceName,
            expectedFirstInstanceName,
          ])
        })
      })

      describe('object with compound Name', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = getInstancesOfObjectType(elements, objWithNameField)
        })

        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(
            `SELECT Id,FirstName,LastName,Salutation,MiddleName,Suffix,TestField FROM ${withNameName}`,
          )
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual([
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            testNamespace,
            RECORDS_PATH,
            withNameName,
            expectedFirstInstanceName,
          ])
        })

        it('should create the instances with ElemID name according to the getElemID func', () => {
          expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
        })

        it('should create instance with values according to objects fields', () => {
          const { value } = instances[0]
          // Name is compound so First & Last name values should be inside Name
          expect(value.LastName).toBeUndefined()
          expect(value.FirstName).toBeUndefined()
          expect(value.Name).toEqual({
            FirstName: 'First',
            LastName: 'Last',
          })
          expect(value.TestField).toEqual('Test')
        })

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
        })
      })

      describe('object with compound Address', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = getInstancesOfObjectType(elements, objWithAddressField)
        })

        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(
            `SELECT Id,Name,TestField,OtherAddress FROM ${withAddressName}`,
          )
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual([
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            testNamespace,
            RECORDS_PATH,
            withAddressName,
            expectedFirstInstanceName,
          ])
        })

        it('should create the instances with ElemID name according to the getElemID func', () => {
          expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
        })

        it('should create instance with values according to objects fields', () => {
          const { value } = instances[0]
          expect(value.Name).toEqual('Name')
          expect(value.TestField).toEqual('Test')
          expect(value.OtherAddress).toEqual({
            city: 'city',
            counry: 'country',
          })
        })

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
        })
      })
    })

    describe('referenceTo fetching logic', () => {
      let elements: Element[]

      const refToObject = createCustomObject(refToObjectName)
      const refToFromNamespaceObject = createCustomObject(
        refToFromNamespaceObjectName,
      )
      const emptyRefToObject = createCustomObject(emptyRefToObjectName)

      const refFromAndToObject = createCustomObject(refFromAndToObjectName, {
        Parent: {
          refType: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'parent field',
            [API_NAME]: 'Parent',
            // ReferenceExpression is here on purpose to make sure
            // we handle a use-case of unresolved reference to the type. (e.g. in Partial Fetch)
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [
              new ReferenceExpression(refToObject.elemID),
            ],
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
          },
        },
        Pricebook2Id: {
          refType: Types.primitiveDataTypes.Lookup,
          annotations: {
            [LABEL]: 'Pricebook2Id field',
            [API_NAME]: 'Pricebook2Id',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToFromNamespaceObjectName],
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
          },
        },
      })

      const namespacedRefFromName = `${refFromNamespace}___refFrom__c`
      const namespacedRefFromObject = createCustomObject(
        namespacedRefFromName,
        {
          Parent: {
            refType: Types.primitiveDataTypes.MasterDetail,
            annotations: {
              [LABEL]: 'parent field',
              [API_NAME]: 'Parent',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refFromAndToObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
            },
          },
          Pricebook2Id: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [LABEL]: 'Pricebook2Id field',
              [API_NAME]: 'Pricebook2Id',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
            },
          },
        },
      )

      beforeEach(async () => {
        elements = [
          refToObject,
          refToFromNamespaceObject,
          refFromAndToObject,
          namespacedRefFromObject,
          emptyRefToObject,
        ]
        await filter.onFetch(elements)
      })

      it('should add instances per configured object', async () => {
        // 5 object + 2 new instances per needed instances (all by empty ref)
        expect(elements.length).toEqual(13)
        expect(
          (
            await awu(elements)
              .filter((e) => isInstanceElement(e))
              .toArray()
          ).length,
        ).toEqual(8)
      })

      it('should query refTo by ids according to references values', () => {
        // The query should be split according to MAX_IDS_PER_INSTANCES_QUERY
        expect(basicQueryImplementation).toHaveBeenCalledWith(
          `SELECT Id,Name,TestField FROM ${refToObjectName} WHERE Id IN ('hijklmn','abcdefg')`,
        )
      })

      it('should query all namespaced/included objects not by id', () => {
        expect(basicQueryImplementation).toHaveBeenCalledWith(
          `SELECT Id,Name,TestField FROM ${refToFromNamespaceObjectName}`,
        )
        expect(basicQueryImplementation).toHaveBeenCalledWith(
          `SELECT Id,Name,TestField,Parent,Pricebook2Id FROM ${namespacedRefFromName}`,
        )
        expect(basicQueryImplementation).toHaveBeenCalledWith(
          `SELECT Id,Name,TestField,Parent,Pricebook2Id FROM ${refFromAndToObjectName}`,
        )
      })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })
  })

  describe('When configured with default autoDetectParentFields + name', () => {
    let elements: Element[]

    const refToObject = createCustomObject(refToObjectName)
    const refFromObjectName = `${nameBasedNamespace}__refFrom__c`
    const refFromObject = createCustomObject(refFromObjectName, {
      Parent: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'master field',
          [API_NAME]: 'MasterField',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
        },
      },
    })

    const grandparentObjectName = `${nameBasedNamespace}__grandparent__c`
    const grandparentObject = createCustomObject(grandparentObjectName)

    const parentObjectName = `${nameBasedNamespace}__parent__c`
    const parentObject = createCustomObject(parentObjectName, {
      Grandparent: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'master field',
          [API_NAME]: 'MasterField',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [grandparentObjectName],
        },
      },
    })

    const pricebookEntryName = 'PricebookEntry'
    const pricebookEntryObject = createCustomObject(pricebookEntryName, {
      Pricebook2Id: {
        refType: Types.primitiveDataTypes.Lookup,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'Pricebook2Id field',
          [API_NAME]: 'Pricebook2Id',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [grandparentObjectName],
        },
      },
    })

    const productName = 'Product2'
    const productObject = createCustomObject(productName, {
      ProductCode: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'ProductCode field',
          [API_NAME]: 'ProductCode',
        },
      },
    })

    const SBQQCustomActionName = 'SBQQ__CustomAction__c'
    const SBQQCustomActionObject = createCustomObject(SBQQCustomActionName, {
      SBQQ__Location__c: {
        refType: Types.primitiveDataTypes.Checkbox,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'Location checkbox field',
          [API_NAME]: 'SBQQ__Location__c',
          [FIELD_ANNOTATIONS.VALUE_SET]: [
            {
              fullName: 'Quote',
              default: true,
              label: 'Quote',
            },
          ],
        },
      },
      SBQQ__DisplayOrder__c: {
        refType: Types.primitiveDataTypes.Number,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'Display order',
          [API_NAME]: 'SBQQ__DisplayOrder__c',
        },
      },
    })

    const grandsonObjectName = `${nameBasedNamespace}__grandson__c`
    const grandsonObject = createCustomObject(grandsonObjectName, {
      Parent: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'master field',
          [API_NAME]: 'MasterField',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [parentObjectName],
        },
      },
    })

    const orphanObjectName = `${nameBasedNamespace}__orphan__c`
    const orphanObject = createCustomObject(orphanObjectName, {
      Parent: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [LABEL]: 'master field',
          [API_NAME]: 'MasterField',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: ['noSuchObject'],
        },
      },
    })

    const badIdFieldsName = 'BadIdFields'
    const badIdFieldsObject = createCustomObject(badIdFieldsName)

    const notQueryableIdFieldsName = 'notQueryableIdFields'
    const notQueryableIdFieldsObject = createCustomObject(
      notQueryableIdFieldsName,
      {
        NotQueryable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'not queryable',
            [API_NAME]: 'NotQueryable',
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
          },
        },
      },
    )

    let changeSuggestions: ConfigChangeSuggestion[]
    beforeEach(async () => {
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              data: {
                includeObjects: [
                  createNamespaceRegexFromString(nameBasedNamespace),
                  pricebookEntryName,
                  SBQQCustomActionName,
                  productName,
                  badIdFieldsName,
                  notQueryableIdFieldsName,
                ],
                allowReferenceTo: [refToObjectName],
                saltoIDSettings: {
                  defaultIdFields: ['##allMasterDetailFields##', 'Name'],
                  overrides: [
                    {
                      objectsRegex: pricebookEntryName,
                      idFields: ['Pricebook2Id', 'Name'],
                    },
                    {
                      objectsRegex: SBQQCustomActionName,
                      idFields: [
                        'SBQQ__Location__c',
                        'SBQQ__DisplayOrder__c',
                        'Name',
                      ],
                    },
                    { objectsRegex: badIdFieldsName, idFields: ['Bad'] },
                    {
                      objectsRegex: productName,
                      idFields: ['ProductCode', 'Name'],
                    },
                    {
                      objectsRegex: notQueryableIdFieldsName,
                      idFields: ['NotQueryable'],
                    },
                  ],
                },
              },
            },
          }),
        },
      }) as FilterType
      elements = [
        grandparentObject,
        parentObject,
        grandsonObject,
        orphanObject,
        productObject,
        pricebookEntryObject,
        SBQQCustomActionObject,
        refFromObject,
        refToObject,
        badIdFieldsObject,
        notQueryableIdFieldsObject,
      ]
      changeSuggestions =
        (
          ((await filter.onFetch(elements)) ?? {
            configSuggestions: [],
            errors: [],
          }) as FilterResult
        ).configSuggestions ?? []
    })

    it('should add instances per configured object', async () => {
      // 2 new instances per configured object because of TestCustomRecords's length
      expect(elements.length).toEqual(27)
      expect(
        (
          await awu(elements)
            .filter((e) => isInstanceElement(e))
            .toArray()
        ).length,
      ).toEqual(16)
    })

    describe('grandparent object (no master)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, grandparentObject)
      })

      it('should base elemID on record name only', () => {
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`,
        )
      })
    })

    describe('parent object (master is grandparent)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, parentObject)
      })

      it('should base elemID on grandparentName + parent', () => {
        const grandparentName = TestCustomRecords[1].Name
        const parentName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}`,
        )
      })
    })

    describe('grandson object (master is parent who has grandparent as master)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, grandsonObject)
      })

      it('should base elemID on grandparentName + parent + grandson if all exist', () => {
        const grandparentName = TestCustomRecords[0].Name
        const parentName = TestCustomRecords[1].Name
        const grandsonName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}___${grandsonName}`,
        )
      })
    })

    describe('orphan object (master non-existance)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, orphanObject)
      })
      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithOrphanValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter((suggestion) => suggestion.value.includes(orphanObjectName))
        expect(changeSuggestionWithOrphanValue).toHaveLength(1)
        expect(changeSuggestionWithOrphanValue[0].type).toEqual(
          'dataObjectsExclude',
        )
        expect(changeSuggestionWithOrphanValue[0].reason).toEqual(
          `${orphanObjectName} has Parent (reference) configured as idField. Failed to resolve some of the references.`,
        )
      })
    })

    describe('badIdFields object', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, badIdFieldsObject)
      })

      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithBadFieldsValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter((suggestion) => suggestion.value.includes(badIdFieldsName))
        expect(changeSuggestionWithBadFieldsValue).toHaveLength(1)
        expect(changeSuggestionWithBadFieldsValue[0].type).toEqual(
          'dataObjectsExclude',
        )
        expect(changeSuggestionWithBadFieldsValue[0].reason).toEqual(
          `Bad defined as idFields but are not queryable or do not exist on type ${badIdFieldsName}`,
        )
      })
    })

    describe('notQueryableIdFields object', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(
          elements,
          notQueryableIdFieldsObject,
        )
      })

      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithBadFieldsValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter((suggestion) =>
            suggestion.value.includes(notQueryableIdFieldsName),
          )
        expect(changeSuggestionWithBadFieldsValue).toHaveLength(1)
        expect(changeSuggestionWithBadFieldsValue[0].type).toEqual(
          'dataObjectsExclude',
        )
        expect(changeSuggestionWithBadFieldsValue[0].reason).toEqual(
          `NotQueryable defined as idFields but are not queryable or do not exist on type ${notQueryableIdFieldsName}`,
        )
      })
    })

    describe('ref from object (with master that is defined as ref to and not "base" object)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, refFromObject)
      })

      it('should base elemID on refTo name as "parent" and refFrom as "child"', () => {
        const refToName = TestCustomRecords[1].Name
        const refFromName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${refToName}___${refFromName}`,
        )
      })
    })

    describe('ref to object (not base object, only fetched cause of ref to it)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, refToObject)
      })

      it('should base elemID on record name', () => {
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`,
        )
      })
    })

    describe('PricebookEntry object (special case - Lookup)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, pricebookEntryObject)
      })

      it('should base elemID on Pricebook2Id lookup name + the entry', () => {
        const pricebookLookupName = TestCustomRecords[1].Name
        const pricebookEntry = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${pricebookLookupName}___${pricebookEntry}`,
        )
      })
    })

    describe('Product2 object - checking case of non-existing values', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, productObject)
      })

      it('should base elemID on name only because value of other field is null', () => {
        const recordName = TestCustomRecords[0].Name
        expect(instances[0].value.ProductCode).toBeNull()
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${recordName}`,
        )
      })

      it('should base elemID on name only because value of other field is undefined', () => {
        const recordName = TestCustomRecords[1].Name
        expect(instances[1].value.ProductCode).toBeUndefined()
        expect(instances[1].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${recordName}`,
        )
      })
    })

    describe('SBQQ__CustomAction__c object (special case - base on record values besides name)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = getInstancesOfObjectType(elements, SBQQCustomActionObject)
      })

      it('should base elemID on Name + displayOrder + location', () => {
        const recordName = TestCustomRecords[0].Name
        const recordLocation = TestCustomRecords[0].SBQQ__Location__c
        const recordDisplayOrder = TestCustomRecords[0].SBQQ__DisplayOrder__c
        expect(instances[0].elemID.name).toEqual(
          `${NAME_FROM_GET_ELEM_ID}${recordLocation}___${recordDisplayOrder}___${recordName}`,
        )
      })
    })
  })

  describe('Fetching with MaxInstancesPerType', () => {
    const testElement = createCustomObject('testElement')
    beforeEach(() => {
      client.queryAll = jest.fn().mockResolvedValue([{ key: 'value' }])
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              data: {
                includeObjects: ['.*'],
                allowReferenceTo: [],
                saltoIDSettings: {
                  defaultIdFields: [],
                  overrides: [],
                },
              },
              maxInstancesPerType: 2,
            },
          }),
        },
      }) as FilterType
    })
    it('Should not fetch CustomObjects with more instances than MaxInstancesPerType', async () => {
      const elements = [testElement]
      client.countInstances = jest.fn().mockResolvedValue(3)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(1)
      expect(result).toMatchObject({
        configSuggestions: [
          {
            type: 'dataObjectsExclude',
            value: 'testElement',
            reason: expect.stringContaining('maxInstancesPerType'),
          },
        ],
      })
    })
    it('Should fetch CustomObjects with less instances than MaxInstancesPerType', async () => {
      const elements = [testElement]
      client.countInstances = jest.fn().mockResolvedValue(1)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(result).toMatchObject({ configSuggestions: [] })
    })
    it('Mixed CustomObjects with more and less instances than MaxInstancesPerType', async () => {
      const elements = [testElement, testElement]
      client.countInstances = jest
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(result).toMatchObject({
        configSuggestions: [
          {
            type: 'dataObjectsExclude',
            value: 'testElement',
            reason: expect.stringContaining('maxInstancesPerType'),
          },
        ],
      })
    })
  })

  describe('Aliases', () => {
    let instances: InstanceElement[]

    const MASTER_DETAIL_TYPE = 'SBQQ__Template__c'
    const MASTER_DETAIL_RECORD_ID = 'a0B8d000008r49lEAA'
    const INSTANCE_TYPE = 'SBQQ__LineColumn__c'

    const createFilterForAliases = (
      saltoAliasSettings?: SaltoAliasSettings,
    ): FilterType =>
      filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              data: {
                includeObjects: ['.*'],
                saltoIDSettings: {
                  defaultIdFields: ['Id'],
                },
                saltoAliasSettings,
              },
            },
          }),
        },
      }) as FilterType

    describe('when calculated alias is not an empty string', () => {
      const MASTER_DETAIL_RECORD = {
        Id: MASTER_DETAIL_RECORD_ID,
        Name: 'ParentName',
      }

      const INSTANCE_RECORD = {
        Id: 'a0C8d000008r49lEAA',
        Name: 'InstanceName',
        SBQQ__FieldName__c: 'TestField',
        SBQQ__Template__c: MASTER_DETAIL_RECORD_ID,
      }

      beforeEach(async () => {
        filter = createFilterForAliases()
        connection.query = jest.fn().mockImplementation((query: string) => {
          if (query.includes(`FROM ${MASTER_DETAIL_TYPE}`)) {
            return Promise.resolve({ records: [MASTER_DETAIL_RECORD] })
          }
          if (query.includes(`FROM ${INSTANCE_TYPE}`)) {
            return Promise.resolve({ records: [INSTANCE_RECORD] })
          }
          return []
        })
        const elements: Element[] = [
          mockTypes[MASTER_DETAIL_TYPE],
          mockTypes[INSTANCE_TYPE],
        ]
        await filter.onFetch(elements)
        instances = elements.filter(isInstanceElement)
      })

      it('should create correct aliases', () => {
        expect(instances).toEqual([
          expect.objectContaining({
            annotations: expect.objectContaining({
              [CORE_ANNOTATIONS.ALIAS]: 'ParentName',
            }),
          }),
          expect.objectContaining({
            annotations: expect.objectContaining({
              [CORE_ANNOTATIONS.ALIAS]: 'ParentName TestField InstanceName',
            }),
          }),
        ])
      })

      describe('when some alias fields are invalid', () => {
        let errors: SaltoError[]
        beforeEach(async () => {
          filter = createFilterForAliases({
            overrides: [
              {
                objectsRegex: INSTANCE_TYPE,
                aliasFields: [
                  DETECTS_PARENTS_INDICATOR,
                  'Name',
                  'InvalidField',
                  'SBQQ__FieldName__c',
                  'AnotherInvalidField',
                ],
              },
            ],
          })
          connection.query = jest.fn().mockImplementation((query: string) => {
            if (query.includes(`FROM ${MASTER_DETAIL_TYPE}`)) {
              return Promise.resolve({ records: [MASTER_DETAIL_RECORD] })
            }
            if (query.includes(`FROM ${INSTANCE_TYPE}`)) {
              return Promise.resolve({ records: [INSTANCE_RECORD] })
            }
            return []
          })
          const elements: Element[] = [
            mockTypes[MASTER_DETAIL_TYPE],
            mockTypes[INSTANCE_TYPE],
          ]
          const result = (await filter.onFetch(elements)) as FilterResult
          errors = result.errors ?? []
          instances = elements.filter(isInstanceElement)
        })
        it('should create correct aliases and warn about invalid fields', async () => {
          expect(instances).toEqual([
            expect.objectContaining({
              annotations: expect.objectContaining({
                [CORE_ANNOTATIONS.ALIAS]: 'ParentName',
              }),
            }),
            expect.objectContaining({
              annotations: expect.objectContaining({
                [CORE_ANNOTATIONS.ALIAS]: 'ParentName InstanceName TestField',
              }),
            }),
          ])
          expect(errors).toEqual([
            {
              message:
                expect.stringContaining('InvalidField') &&
                expect.stringContaining('AnotherInvalidField'),
              severity: 'Warning',
            },
          ])
        })
      })
    })

    describe('when calculated alias is an empty string', () => {
      const MASTER_DETAIL_RECORD = {
        Id: MASTER_DETAIL_RECORD_ID,
        Name: '',
      }

      const INSTANCE_RECORD = {
        Id: 'a0C8d000008r49lEAA',
        Name: '',
        SBQQ__FieldName__c: '',
        SBQQ__Template__c: MASTER_DETAIL_RECORD_ID,
      }

      beforeEach(async () => {
        connection.query = jest.fn().mockImplementation((query: string) => {
          if (query.includes(`FROM ${MASTER_DETAIL_TYPE}`)) {
            return Promise.resolve({ records: [MASTER_DETAIL_RECORD] })
          }
          if (query.includes(`FROM ${INSTANCE_TYPE}`)) {
            return Promise.resolve({ records: [INSTANCE_RECORD] })
          }
          return []
        })
        const elements: Element[] = [
          mockTypes[MASTER_DETAIL_TYPE],
          mockTypes[INSTANCE_TYPE],
        ]
        await createFilterForAliases().onFetch(elements)
        instances = elements.filter(isInstanceElement)
      })
      it('should not create aliases', () => {
        expect(instances).toHaveLength(2)
        instances.forEach((instance) => {
          expect(instance.annotations).not.toContainKey(CORE_ANNOTATIONS.ALIAS)
        })
      })
    })
  })

  describe('Managed by Salto', () => {
    describe('When the field of one of the types is not queryable', () => {
      let elements: Element[]
      let filterResult: FilterResult
      const testTypeName = 'TestType'
      const testInstanceId = 'some_id'
      const testType = createCustomObject(testTypeName, {
        [MANAGED_BY_SALTO_FIELD_NAME]: {
          refType: Types.primitiveDataTypes.Checkbox,
          annotations: {
            [LABEL]: 'Managed By Salto',
            [API_NAME]: MANAGED_BY_SALTO_FIELD_NAME,
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
          },
        },
      })
      const irrelevantType = createCustomObject('IrrelevantType', {
        [MANAGED_BY_SALTO_FIELD_NAME]: {
          refType: Types.primitiveDataTypes.Checkbox,
          annotations: {
            [LABEL]: 'Managed By Salto',
            [API_NAME]: MANAGED_BY_SALTO_FIELD_NAME,
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          },
        },
      })
      const testRecords: SalesforceRecord[] = [
        {
          attributes: {
            type: testTypeName,
          },
          Id: testInstanceId,
          Name: 'Name',
        },
      ]
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: await buildTestFetchProfile({
              types: [
                {
                  typeName: testTypeName,
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
                {
                  typeName: 'unmanagedType',
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
                {
                  typeName: 'IrrelevantType',
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
              ],
            }),
          },
        }) as FilterType

        elements = [testType, irrelevantType]

        testRecords.forEach((record) => {
          record[MANAGED_BY_SALTO_FIELD_NAME] = true
        })
        setMockQueryResults(testRecords)

        filterResult = (await filter.onFetch(elements)) as FilterResult
      })

      it('Should warn', () => {
        expect(filterResult.errors).toEqual([
          {
            message:
              expect.stringContaining('TestType') &&
              expect.stringContaining(MANAGED_BY_SALTO_FIELD_NAME),
            severity: 'Warning',
          },
        ])
        expect(elements).toHaveLength(2)
        expect(basicQueryImplementation).not.toHaveBeenCalledWith(
          expect.stringContaining('TestType'),
        )
      })
    })
    describe('When all the types have inaccessible fields', () => {
      let elements: Element[]
      let filterResult: FilterResult
      const testTypeName = 'TestType'
      const otherTestTypeName = 'OtherTestType'
      const testInstanceId = 'some_id'
      const testType = createCustomObject(testTypeName, {
        [MANAGED_BY_SALTO_FIELD_NAME]: {
          refType: Types.primitiveDataTypes.Checkbox,
          annotations: {
            [LABEL]: 'Managed By Salto',
            [API_NAME]: MANAGED_BY_SALTO_FIELD_NAME,
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
          },
        },
      })
      const unmanagedType = createCustomObject('unmanagedType', {})
      const otherTestType = createCustomObject(otherTestTypeName, {
        [MANAGED_BY_SALTO_FIELD_NAME]: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [LABEL]: 'Managed By Salto',
            [API_NAME]: MANAGED_BY_SALTO_FIELD_NAME,
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          },
        },
      })
      const testRecords: SalesforceRecord[] = [
        {
          attributes: {
            type: testTypeName,
          },
          Id: testInstanceId,
          Name: 'Name',
        },
      ]
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: await buildTestFetchProfile({
              types: [
                {
                  typeName: testTypeName,
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
                {
                  typeName: otherTestTypeName,
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
              ],
            }),
          },
        }) as FilterType

        elements = [testType, otherTestType, unmanagedType]

        testRecords.forEach((record) => {
          record[MANAGED_BY_SALTO_FIELD_NAME] = true
        })
        setMockQueryResults(testRecords)

        filterResult = (await filter.onFetch(elements)) as FilterResult
      })

      it('Should warn', () => {
        expect(filterResult.errors ?? []).not.toBeEmpty()
        expect(filterResult.errors).toEqual([
          {
            message: expect.stringContaining(
              'missing or is of the wrong type for all data records',
            ),
            severity: 'Warning',
          },
        ])
        expect(elements).toHaveLength(3)
      })
    })
  })
  describe('Omit Fields', () => {
    let elements: Element[]
    const testTypeName = 'TestType'
    const testInstanceId = 'some_id'
    const testType: ObjectType = createCustomObject(testTypeName)
    const testRecords: SalesforceRecord[] = [
      {
        attributes: {
          type: testTypeName,
        },
        Id: testInstanceId,
        Name: 'Name',
        TestField: 'Test Field Value',
      },
    ]
    beforeEach(async () => {
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: await buildTestFetchProfile({
            types: [
              {
                typeName: testTypeName,
                included: true,
                excluded: false,
                allowRef: false,
              },
            ],
            omittedFields: [`${testTypeName}.TestField`],
          }),
        },
      }) as FilterType

      elements = [testType]

      testRecords.forEach((record) => {
        record[MANAGED_BY_SALTO_FIELD_NAME] = true
      })
      setMockQueryResults(testRecords)

      await filter.onFetch(elements)
    })

    it('should not fetch omitted fields', () => {
      const queryString = basicQueryImplementation.mock.calls
        .find(([soql]: string[]) => !soql.includes('COUNT()'))
        .pop()
      expect(queryString).not.toContain('TestField')
      expect(queryString).toContain('Name')
    })
  })

  describe('Hierarchy fields', () => {
    describe('Types with Hierarchy fields', () => {
      let elements: Element[]
      const testTypeName = 'TestType'
      const refFromTypeName = 'RefFrom'
      const testInstanceId1 = 'some_id1'
      const testInstanceId2 = 'some_id2'
      const refFromType = createCustomObject(refFromTypeName, {
        RefField: {
          refType: Types.primitiveDataTypes.Lookup,
          annotations: {
            [LABEL]: 'Lookup Field',
            [API_NAME]: 'RefField',
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [testTypeName],
          },
        },
      })
      const typeWithHierarchy = createCustomObject(testTypeName, {
        HierarchyField: {
          refType: Types.primitiveDataTypes.Hierarchy,
          annotations: {
            [LABEL]: 'Hierarchy Field',
            [API_NAME]: 'HierarchyField',
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
          },
        },
      })
      const testRecords: SalesforceRecord[] = [
        {
          attributes: {
            type: refFromTypeName,
          },
          Id: 'refFromId',
          Name: 'RefFromName',
          RefField: testInstanceId1,
        },
        {
          attributes: {
            type: testTypeName,
          },
          Id: testInstanceId1,
          Name: 'TestInstance1Name',
          HierarchyField: testInstanceId2,
        },
        {
          attributes: {
            type: testTypeName,
          },
          Id: testInstanceId2,
          Name: 'TestInstance2Name',
          HierarchyField: testInstanceId1,
        },
      ]
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: await buildTestFetchProfile({
              types: [
                {
                  typeName: testTypeName,
                  included: false,
                  excluded: false,
                  allowRef: true,
                },
                {
                  typeName: refFromTypeName,
                  included: true,
                  excluded: false,
                  allowRef: false,
                },
              ],
            }),
          },
        }) as FilterType

        elements = [refFromType, typeWithHierarchy]

        setMockQueryResults(testRecords)

        await filter.onFetch(elements)
      })
      it('should follow references from Hierarchy fields', () => {
        expect(elements).toHaveLength(2 + testRecords.length)
        expect(elements).toIncludeAllPartialMembers([
          {
            elemID: new ElemID(
              SALESFORCE,
              refFromTypeName,
              'instance',
              `${NAME_FROM_GET_ELEM_ID}refFromId`,
            ),
          },
          {
            elemID: new ElemID(
              SALESFORCE,
              testTypeName,
              'instance',
              `${NAME_FROM_GET_ELEM_ID}${testInstanceId1}`,
            ),
          },
          {
            elemID: new ElemID(
              SALESFORCE,
              testTypeName,
              'instance',
              `${NAME_FROM_GET_ELEM_ID}${testInstanceId2}`,
            ),
          },
        ])
      })
    })
  })
  describe('Fetch with changes detection', () => {
    let fetchProfile: FetchProfile
    const testTypeName = 'TestType'
    const changedAtCutoff = new Date(2023, 12, 21).toISOString()

    describe('When enabled', () => {
      beforeEach(async () => {
        const changedAtSingleton = mockInstances()[CHANGED_AT_SINGLETON]
        _.set(
          changedAtSingleton.value,
          [DATA_INSTANCES_CHANGED_AT_MAGIC, testTypeName],
          changedAtCutoff,
        )

        const elementsSource = buildElementsSourceFromElements([
          changedAtSingleton,
        ])
        fetchProfile = await buildTestFetchProfile({
          types: [
            {
              typeName: testTypeName,
              included: true,
              excluded: false,
              allowRef: false,
            },
          ],
          elementsSourceForQuickFetch: elementsSource,
        })
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile,
          },
        }) as FilterType
        await filter.onFetch([
          createCustomObject(testTypeName),
          changedAtSingleton,
        ])
      })
      it('Should query using the changed-at value', () => {
        expect(basicQueryImplementation).toHaveBeenLastCalledWith(
          expect.stringContaining(`LastModifiedDate > ${changedAtCutoff}`),
        )
      })
    })

    describe('When disabled', () => {
      beforeEach(async () => {
        fetchProfile = await buildTestFetchProfile({
          types: [
            {
              typeName: testTypeName,
              included: true,
              excluded: false,
              allowRef: false,
            },
          ],
        })
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile,
          },
        }) as FilterType
        await filter.onFetch([createCustomObject(testTypeName)])
      })
      it('Should not query using the changed-at value', () => {
        expect(basicQueryImplementation).toHaveBeenLastCalledWith(
          expect.not.stringContaining(`LastModifiedDate > ${changedAtCutoff}`),
        )
      })
    })
  })
})

describe('buildSelectQueries', () => {
  let customObject: ObjectType
  beforeEach(() => {
    customObject = createCustomObject('Test')
  })
  describe('without conditions', () => {
    let queries: string[]
    beforeEach(async () => {
      const fieldNames = await awu(Object.values(customObject.fields))
        .flatMap(getFieldNamesForQuery)
        .toArray()
      queries = buildSelectQueries('Test', fieldNames)
    })
    it('should create a select query on the specified fields', () => {
      expect(queries).toHaveLength(1)
      expect(queries[0]).toEqual('SELECT Id,Name,TestField FROM Test')
    })
  })
  describe('with exact conditions', () => {
    describe('with short query', () => {
      let queries: string[]
      beforeEach(async () => {
        const fieldNames = await awu([customObject.fields.Id])
          .flatMap(getFieldNamesForQuery)
          .toArray()
        queries = buildSelectQueries(
          'Test',
          fieldNames,
          _.range(0, 2)
            .map((idx) => [
              [
                {
                  fieldName: 'Id',
                  operator: 'IN' as const,
                  value: `'id${idx}'`,
                },
              ],
              [
                {
                  fieldName: 'Name',
                  operator: 'IN' as const,
                  value: `'name${idx}'`,
                },
              ],
            ])
            .flat(),
        )
      })
      it('should create query with WHERE clause', () => {
        expect(queries).toHaveLength(1)
        expect(queries[0]).toEqual(
          "SELECT Id FROM Test WHERE Id IN ('id0','id1') AND Name IN ('name0','name1')",
        )
      })
    })
    describe('with query length limit', () => {
      let queries: string[]
      beforeEach(async () => {
        const fieldNames = await awu([customObject.fields.Id])
          .flatMap(getFieldNamesForQuery)
          .toArray()
        const queryLimits: SoqlQueryLimits = {
          maxQueryLength: 80,
          maxWhereClauseLength: 55,
        }
        queries = buildSelectQueries(
          'Test',
          fieldNames,
          _.range(0, 4)
            .map((idx) => [
              [
                {
                  fieldName: 'Id',
                  operator: 'IN' as const,
                  value: `'id${idx}'`,
                },
              ],
              [
                {
                  fieldName: 'Name',
                  operator: 'IN' as const,
                  value: `'name${idx}'`,
                },
              ],
            ])
            .flat(),
          queryLimits,
        )
      })
      it('should create queries that do not exceed query length', () => {
        expect(queries).toHaveLength(2)
        const queryLengths = queries.map((query) => query.length)
        expect(_.max(queryLengths)).toBeLessThanOrEqual(80)
        expect(queries[0]).toEqual(
          "SELECT Id FROM Test WHERE Id IN ('id0','id1') AND Name IN ('name0','name1')",
        )
        expect(queries[1]).toEqual(
          "SELECT Id FROM Test WHERE Id IN ('id2','id3') AND Name IN ('name2','name3')",
        )
      })
    })
  })
  describe('with limiting conditions', () => {
    let queries: string[]
    const limitIdTo = (
      operator: QueryOperator,
      operand: string,
    ): SoqlQuery => ({
      fieldName: 'Id',
      operator,
      value: operand,
    })
    describe('with no exact conditions', () => {
      beforeEach(async () => {
        const fieldNames = ['Id']
        queries = buildSelectQueries('Test', fieldNames, [
          [limitIdTo('>', '7')],
        ])
      })
      it('should create a single valid query', () => {
        expect(queries).toEqual(['SELECT Id FROM Test WHERE Id > 7'])
      })
    })
    describe('with exact conditions', () => {
      beforeEach(async () => {
        const fieldNames = ['Id']
        queries = buildSelectQueries('Test', fieldNames, [
          [{ fieldName: 'Id', operator: 'IN', value: "'8'" }],
          [limitIdTo('>', '7')],
        ])
      })
      it('should create a single valid query that ends with the complex query', () => {
        expect(queries).toEqual([
          "SELECT Id FROM Test WHERE Id IN ('8') AND Id > 7",
        ])
      })
    })
    describe('with exact conditions that are too long for a single query', () => {
      beforeEach(async () => {
        const fieldNames = ['Id']
        const queryLimits: SoqlQueryLimits = {
          maxQueryLength: 45,
          maxWhereClauseLength: 15,
        }
        queries = buildSelectQueries(
          'Test',
          fieldNames,
          [
            [{ fieldName: 'Id', operator: 'IN', value: "'8'" }],
            [{ fieldName: 'Id', operator: 'IN', value: "'9'" }],
            [limitIdTo('>', '7')],
          ],
          queryLimits,
        )
      })
      it('should create multiple valid queries that end with the complex query', () => {
        expect(queries).toEqual([
          "SELECT Id FROM Test WHERE Id IN ('8') AND Id > 7",
          "SELECT Id FROM Test WHERE Id IN ('9') AND Id > 7",
        ])
      })
    })
    describe('with multiple complex conditions', () => {
      beforeEach(async () => {
        const fieldNames = ['Id']
        queries = buildSelectQueries('Test', fieldNames, [
          [{ fieldName: 'Id', operator: 'IN', value: "'8'" }],
          [limitIdTo('>', '7'), limitIdTo('<', '10')],
        ])
      })
      it('should create a single valid query that ends with the complex query', () => {
        expect(queries).toEqual([
          "SELECT Id FROM Test WHERE Id IN ('8') AND Id > 7 AND Id < 10",
        ])
      })
    })
    describe('with a exact conditions that is too long for a single query and multiple complex conditions', () => {
      beforeEach(async () => {
        const fieldNames = ['Id']
        const queryLimits: SoqlQueryLimits = {
          maxQueryLength: 55,
          maxWhereClauseLength: 35,
        }
        queries = buildSelectQueries(
          'Test',
          fieldNames,
          [
            [{ fieldName: 'Id', operator: 'IN', value: "'8'" }],
            [{ fieldName: 'Id', operator: 'IN', value: "'9'" }],
            [limitIdTo('>', '7'), limitIdTo('<', '10')],
          ],
          queryLimits,
        )
      })
      it('should create multiple valid queries that end with the entire complex query', () => {
        expect(queries).toEqual([
          "SELECT Id FROM Test WHERE Id IN ('8') AND Id > 7 AND Id < 10",
          "SELECT Id FROM Test WHERE Id IN ('9') AND Id > 7 AND Id < 10",
        ])
      })
    })
  })
})
