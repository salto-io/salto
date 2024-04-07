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
  Element,
  ElemID,
  FetchResult,
  getRestriction,
  InstanceElement,
  isListType,
  isServiceId,
  ListType,
  ObjectType,
  ServiceIds,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { MetadataInfo } from '@salto-io/jsforce'
import { collections, values } from '@salto-io/lowerdash'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from '@salto-io/jsforce-types'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import {
  apiName,
  createInstanceElement,
  MetadataObjectType,
  Types,
} from '../src/transformers/transformer'
import {
  createCustomObjectType,
  findElements,
  mockFetchOpts,
  ZipFile,
} from './utils'
import mockAdapter from './adapter'
import * as constants from '../src/constants'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'
import {
  mockDescribeResult,
  MockDescribeResultInput,
  mockDescribeValueResult,
  MockDescribeValueResultInput,
  mockFileProperties,
  MockFilePropertiesInput,
  mockRetrieveLocator,
  mockRetrieveResult,
} from './connection'
import {
  ConfigChangeSuggestion,
  FetchElements,
  MAX_ITEMS_IN_RETRIEVE_REQUEST,
} from '../src/types'
import * as fetchModule from '../src/fetch'
import { fetchMetadataInstances, retrieveMetadataInstances } from '../src/fetch'
import * as xmlTransformerModule from '../src/transformers/xml_transformer'
import {
  APEX_CLASS_METADATA_TYPE,
  CUSTOM_OBJECT,
  DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
  PROFILE_METADATA_TYPE,
  SALESFORCE,
  SALESFORCE_ERRORS,
  SOCKET_TIMEOUT,
} from '../src/constants'
import {
  apiNameSync,
  isInstanceOfType,
  isInstanceOfTypeSync,
} from '../src/filters/utils'
import { NON_TRANSIENT_SALESFORCE_ERRORS } from '../src/config_change'
import SalesforceClient from '../src/client/client'
import createMockClient from './client'
import { mockInstances, mockTypes } from './mock_elements'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'

const { makeArray } = collections.array
const { awu } = collections.asynciterable
const { INVALID_CROSS_REFERENCE_KEY } = SALESFORCE_ERRORS

describe('SalesforceAdapter fetch', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let fetchMetadataInstancesSpy: jest.SpyInstance
  let changedAtSingleton: InstanceElement

  class SFError extends Error {
    constructor(name: string, message?: string) {
      super(message)
      this.name = name
    }
  }

  const metadataExclude = [
    { metadataType: 'Test1' },
    { metadataType: 'Ignored1' },
    { metadataType: '.*Test2', name: 'instance1.*' },
    { name: '.*SkippedList' },
    { metadataType: 'ReportFolder', name: 'skip' },
    { metadataType: '.*AssignmentRules', name: 'MyRules.*' },
  ]

  const testMaxItemsInRetrieveRequest = 20

  const mockGetElemIdFunc = (
    adapterName: string,
    _serviceIds: ServiceIds,
    name: string,
  ): ElemID => new ElemID(adapterName, name)

  beforeEach(() => {
    changedAtSingleton = mockInstances().ChangedAtSingleton
    const elementsSource = buildElementsSourceFromElements([changedAtSingleton])
    ;({ connection, adapter } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
        config: {
          fetch: {
            metadata: {
              exclude: metadataExclude,
            },
          },
          maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
          client: {
            readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
          },
        },
        elementsSource,
      },
    }))
    fetchMetadataInstancesSpy = jest.spyOn(
      fetchModule,
      'fetchMetadataInstances',
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.restoreAllMocks()
  })

  describe('should fetch metadata types', () => {
    type MockInstanceParams = {
      props: Omit<MockFilePropertiesInput, 'type'> &
        Partial<Pick<MockFilePropertiesInput, 'type'>>
      values: MetadataInfo & Record<string, unknown>
      zipFiles?: ZipFile[]
    }
    const mockMetadataType = (
      typeDef: MockDescribeResultInput,
      valueDef: MockDescribeValueResultInput,
      instances?: MockInstanceParams[],
      chunkSize = testMaxItemsInRetrieveRequest,
      organizationNamespace?: string,
    ): void => {
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult([typeDef], organizationNamespace),
      )
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult(valueDef),
      )
      if (instances !== undefined) {
        connection.metadata.list.mockResolvedValue(
          instances.map((inst) =>
            mockFileProperties({ type: typeDef.xmlName, ...inst.props }),
          ),
        )
        connection.metadata.read.mockImplementation(async (type, fullNames) =>
          type === typeDef.xmlName
            ? makeArray(fullNames)
                .map((name) =>
                  instances.find((inst) => inst.props.fullName === name),
                )
                .filter(values.isDefined)
                .map((inst) => inst.values)
            : [],
        )
        const zipFiles = instances
          .map((inst) => inst.zipFiles)
          .filter(values.isDefined)
        if (!_.isEmpty(zipFiles)) {
          _.chunk(zipFiles, chunkSize).forEach((chunkFiles) =>
            connection.metadata.retrieve.mockReturnValueOnce(
              mockRetrieveLocator({
                zipFiles: _.flatten(chunkFiles),
              }),
            ),
          )
        }
      }
    }

    const mockMetadataTypes = (
      typeDefs: MockDescribeResultInput[],
      valueDef: MockDescribeValueResultInput,
      instancesByType: Record<string, MockInstanceParams[]>,
      chunkSize = testMaxItemsInRetrieveRequest,
    ): void => {
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult(typeDefs),
      )
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult(valueDef),
      )
      connection.metadata.list.mockImplementation(async (queries) => {
        const { type } = makeArray(queries)[0]
        return instancesByType[type]?.map((inst) =>
          mockFileProperties({ type, ...inst.props }),
        )
      })
      connection.metadata.read.mockImplementation(async (type) =>
        instancesByType[type].map((inst) => inst.values),
      )
      const zipFiles = _.flatten(Object.values(instancesByType))
        .map((inst) => inst.zipFiles)
        .filter(values.isDefined)
      if (!_.isEmpty(zipFiles)) {
        _.chunk(zipFiles, chunkSize).forEach((chunkFiles) =>
          connection.metadata.retrieve.mockReturnValueOnce(
            mockRetrieveLocator({
              zipFiles: _.flatten(chunkFiles),
            }),
          ),
        )
      }
    }

    describe('profiles fetch with changes detection', () => {
      const DATE = '2023-01-12T00:00:00.000Z'
      const GREATER_DATE = '2023-02-12T00:00:00.000Z'
      const UPDATED_PROFILE_FULL_NAME = 'updatedProfile'
      const NON_UPDATED_PROFILE_FULL_NAME = 'nonUpdatedProfile'
      const APEX_CLASS_FULL_NAME = 'apexClass'
      const ANOTHER_APEX_CLASS_FULL_NAME = 'anotherApexClass'
      const CUSTOM_METADATA_FULL_NAME = 'MDType.Record1'

      const testData = {
        [UPDATED_PROFILE_FULL_NAME]: {
          zipFileName: `profiles/${UPDATED_PROFILE_FULL_NAME}.profile`,
          zipFileContent: `<?xml version="1.0" encoding="UTF-8"?>
                          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>58.0</apiVersion>
                          </Profile>`,
        },
        [NON_UPDATED_PROFILE_FULL_NAME]: {
          zipFileName: `profiles/${NON_UPDATED_PROFILE_FULL_NAME}.profile`,
          zipFileContent: `<?xml version="1.0" encoding="UTF-8"?>
                          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>58.0</apiVersion>
                          </Profile>`,
        },
        [APEX_CLASS_FULL_NAME]: {
          zipFileName: `apexClass/${APEX_CLASS_FULL_NAME}.apex_class`,
          zipFileContent: `<?xml version="1.0" encoding="UTF-8"?>
                          <ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>58.0</apiVersion>
                          </ApexClass>`,
        },
        [ANOTHER_APEX_CLASS_FULL_NAME]: {
          zipFileName: `apexClass/${ANOTHER_APEX_CLASS_FULL_NAME}.apex_class`,
          zipFileContent: `<?xml version="1.0" encoding="UTF-8"?>
                          <ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>58.0</apiVersion>
                          </ApexClass>`,
        },
        [CUSTOM_METADATA_FULL_NAME]: {
          zipFileName: `customMetadata/${CUSTOM_METADATA_FULL_NAME}.md`,
          zipFileContent: `<?xml version="1.0" encoding="UTF-8"?>
                          <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
                              <fullName>${CUSTOM_METADATA_FULL_NAME}</fullName>
                          </CustomMetadata>`,
        },
      } as const

      type SetMocksMode = 'relatedApexChanged' | 'relatedApexNotChanged'

      const setupMocks = (mode: SetMocksMode): void => {
        connection.metadata.describe.mockResolvedValue(
          mockDescribeResult([
            { xmlName: PROFILE_METADATA_TYPE, metaFile: false },
            { xmlName: APEX_CLASS_METADATA_TYPE, metaFile: false },
            { xmlName: constants.CUSTOM_METADATA, metaFile: false },
          ]),
        )
        connection.metadata.list.mockImplementation(async (queries) =>
          makeArray(queries).flatMap((query) => {
            if (query.type === PROFILE_METADATA_TYPE) {
              return [
                mockFileProperties({
                  type: PROFILE_METADATA_TYPE,
                  fullName: UPDATED_PROFILE_FULL_NAME,
                  lastModifiedDate: GREATER_DATE,
                  fileName: testData.updatedProfile.zipFileName,
                }),
                mockFileProperties({
                  type: PROFILE_METADATA_TYPE,
                  fullName: NON_UPDATED_PROFILE_FULL_NAME,
                  lastModifiedDate: DATE,
                  fileName: testData.nonUpdatedProfile.zipFileName,
                }),
              ]
            }
            if (query.type === APEX_CLASS_METADATA_TYPE) {
              return [
                mockFileProperties({
                  type: APEX_CLASS_METADATA_TYPE,
                  fullName: APEX_CLASS_FULL_NAME,
                  lastModifiedDate:
                    mode === 'relatedApexChanged' ? GREATER_DATE : DATE,
                  fileName: testData.apexClass.zipFileName,
                }),
                // Make sure we don't attempt to retrieve the non-changed apex class
                mockFileProperties({
                  type: APEX_CLASS_METADATA_TYPE,
                  fullName: ANOTHER_APEX_CLASS_FULL_NAME,
                  lastModifiedDate: DATE,
                  fileName: testData.anotherApexClass.zipFileName,
                }),
              ]
            }
            if (query.type === constants.CUSTOM_METADATA) {
              return [
                mockFileProperties({
                  type: constants.CUSTOM_METADATA,
                  fullName: CUSTOM_METADATA_FULL_NAME,
                  lastModifiedDate: '',
                  fileName: testData[CUSTOM_METADATA_FULL_NAME].zipFileName,
                }),
              ]
            }
            return []
          }),
        )
        connection.metadata.retrieve.mockImplementation((request) => {
          const fullNamesByType = Object.fromEntries(
            request.unpackaged?.types.map((entry) => [
              entry.name,
              entry.members,
            ]) ?? [],
          )
          const zipFiles: ZipFile[] = []
          if (
            fullNamesByType[PROFILE_METADATA_TYPE]?.includes(
              UPDATED_PROFILE_FULL_NAME,
            )
          ) {
            zipFiles.push({
              path: `unpackaged/${testData.updatedProfile.zipFileName}`,
              content: testData.updatedProfile.zipFileContent,
            })
          }
          if (
            fullNamesByType[PROFILE_METADATA_TYPE]?.includes(
              NON_UPDATED_PROFILE_FULL_NAME,
            )
          ) {
            zipFiles.push({
              path: `unpackaged/${testData.nonUpdatedProfile.zipFileName}`,
              content: testData[NON_UPDATED_PROFILE_FULL_NAME].zipFileContent,
            })
          }
          if (
            fullNamesByType[APEX_CLASS_METADATA_TYPE]?.includes(
              APEX_CLASS_FULL_NAME,
            )
          ) {
            zipFiles.push({
              path: `unpackaged/${testData.apexClass.zipFileName}-meta.xml`,
              content: testData.apexClass.zipFileContent,
            })
          }
          if (
            fullNamesByType[APEX_CLASS_METADATA_TYPE]?.includes(
              ANOTHER_APEX_CLASS_FULL_NAME,
            )
          ) {
            zipFiles.push({
              path: `unpackaged/${testData.anotherApexClass.zipFileName}-meta.xml`,
              content: testData.anotherApexClass.zipFileContent,
            })
          }
          if (
            fullNamesByType[constants.CUSTOM_METADATA]?.includes(
              CUSTOM_METADATA_FULL_NAME,
            )
          ) {
            zipFiles.push({
              path: `unpackaged/${testData[CUSTOM_METADATA_FULL_NAME].zipFileName}`,
              content: testData[CUSTOM_METADATA_FULL_NAME].zipFileContent,
            })
          }
          return mockRetrieveLocator({ zipFiles })
        })
      }

      beforeEach(() => {
        const updatedProfileInstance = createInstanceElement(
          {
            fullName: UPDATED_PROFILE_FULL_NAME,
            apiVersion: '57.0',
          },
          mockTypes.Profile,
        )
        const nonUpdatedProfileInstance = createInstanceElement(
          {
            fullName: NON_UPDATED_PROFILE_FULL_NAME,
            apiVersion: '57.0',
          },
          mockTypes.Profile,
        )
        const apexClassInstance = createInstanceElement(
          {
            fullName: APEX_CLASS_FULL_NAME,
            apiVersion: '57.0',
          },
          mockTypes.ApexClass,
        )
        const anotherApexClassInstance = createInstanceElement(
          {
            fullName: ANOTHER_APEX_CLASS_FULL_NAME,
            apiVersion: '57.0',
          },
          mockTypes.ApexClass,
        )

        changedAtSingleton.value = {
          [PROFILE_METADATA_TYPE]: {
            [UPDATED_PROFILE_FULL_NAME]: DATE,
            [NON_UPDATED_PROFILE_FULL_NAME]: DATE,
          },
          [APEX_CLASS_METADATA_TYPE]: {
            [APEX_CLASS_FULL_NAME]: DATE,
            [ANOTHER_APEX_CLASS_FULL_NAME]: DATE,
          },
        }
        const elementsSource = buildElementsSourceFromElements([
          mockTypes.ApexClass,
          mockTypes.Profile,
          mockTypes.CustomMetadata,
          mockTypes.CustomMetadataRecordType,
          apexClassInstance,
          anotherApexClassInstance,
          updatedProfileInstance,
          nonUpdatedProfileInstance,
          changedAtSingleton,
        ])
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {
              fetch: {
                metadata: {
                  include: [{ metadataType: '.*' }],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
            elementsSource,
          },
        }))
      })
      describe('when no related instances were changed', () => {
        beforeEach(() => {
          setupMocks('relatedApexNotChanged')
        })
        it('should only fetch the updated profile instance', async () => {
          const fetchRes = await adapter.fetch({
            ...mockFetchOpts,
            withChangesDetection: true,
          })
          const fetchedInstances = fetchRes.elements.filter(isInstanceElement)
          const profileInstances = fetchedInstances.filter(
            isInstanceOfTypeSync(PROFILE_METADATA_TYPE),
          )
          // Make sure we didn't create any related props instances that were not changed
          expect(fetchedInstances).not.toSatisfy(
            isInstanceOfTypeSync(APEX_CLASS_METADATA_TYPE),
          )
          expect(profileInstances.length).toEqual(1)
          expect(profileInstances[0].value).toMatchObject({
            fullName: UPDATED_PROFILE_FULL_NAME,
            apiVersion: 58,
          })
          // Make sure we fetch the CustomMetadata instance
          expect(fetchedInstances).toSatisfyAny(
            (instance) => apiNameSync(instance) === CUSTOM_METADATA_FULL_NAME,
          )
        })
      })

      describe('when related instances were changed', () => {
        beforeEach(() => {
          setupMocks('relatedApexChanged')
        })
        it('should fetch the correct instances', async () => {
          const fetchRes = await adapter.fetch({
            ...mockFetchOpts,
            withChangesDetection: true,
          })
          const fetchedInstances = fetchRes.elements.filter(isInstanceElement)
          const profileInstances = fetchedInstances.filter(
            isInstanceOfTypeSync(PROFILE_METADATA_TYPE),
          )
          expect(profileInstances.length).toEqual(2)
          const updatedProfileInstance = profileInstances.find(
            (inst) => apiNameSync(inst) === UPDATED_PROFILE_FULL_NAME,
          ) as InstanceElement
          const nonUpdatedProfileInstance = profileInstances.find(
            (inst) => apiNameSync(inst) === NON_UPDATED_PROFILE_FULL_NAME,
          ) as InstanceElement
          expect(updatedProfileInstance).toBeDefined()
          expect(nonUpdatedProfileInstance).toBeDefined()
          expect(updatedProfileInstance.value).toMatchObject({
            fullName: UPDATED_PROFILE_FULL_NAME,
            apiVersion: 58,
          })
          expect(nonUpdatedProfileInstance.value).toMatchObject({
            fullName: NON_UPDATED_PROFILE_FULL_NAME,
            apiVersion: 58,
          })
          const fetchedApexClasses = fetchedInstances.filter(
            isInstanceOfTypeSync(APEX_CLASS_METADATA_TYPE),
          )
          expect(fetchedApexClasses).toHaveLength(1)
          expect(fetchedApexClasses[0]).toSatisfy(
            (instance) => apiNameSync(instance) === APEX_CLASS_FULL_NAME,
          )
        })
      })
    })

    describe('partial fetch deletions detection', () => {
      let testAdapter: SalesforceAdapter
      let testConnection: MockInterface<Connection>
      beforeEach(() => {
        const existingElements = [
          mockInstances().ChangedAtSingleton,
          mockTypes.Layout,
          mockTypes.ApexClass,
          mockTypes.CustomObject,
          createInstanceElement({ fullName: 'Layout1' }, mockTypes.Layout),
          createInstanceElement({ fullName: 'Layout2' }, mockTypes.Layout),
          createInstanceElement(
            { fullName: 'DeletedLayout' },
            mockTypes.Layout,
          ),
          createInstanceElement({ fullName: 'Apex1' }, mockTypes.ApexClass),
          createInstanceElement({ fullName: 'Apex2' }, mockTypes.ApexClass),
          createInstanceElement(
            { fullName: 'DeletedApex' },
            mockTypes.ApexClass,
          ),
          createCustomObjectType('Account', {}),
          createCustomObjectType('Deleted__c', {}),
        ]
        const elementsSource = buildElementsSourceFromElements(existingElements)
        ;({ connection: testConnection, adapter: testAdapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {
              fetch: {
                metadata: {
                  include: [{ metadataType: '.*' }],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
            elementsSource,
          },
        }))
        testConnection.metadata.describe.mockResolvedValue(
          mockDescribeResult([{ xmlName: 'Layout' }, { xmlName: 'ApexClass' }]),
        )
        testConnection.metadata.list.mockImplementation(async (queries) =>
          makeArray(queries).flatMap((query) => {
            if (query.type === 'Layout') {
              return [
                mockFileProperties({ type: 'Layout', fullName: 'Layout1' }),
                mockFileProperties({ type: 'Layout', fullName: 'Layout2' }),
              ]
            }
            if (query.type === 'ApexClass') {
              return [
                mockFileProperties({ type: 'ApexClass', fullName: 'Apex1' }),
                mockFileProperties({ type: 'ApexClass', fullName: 'Apex2' }),
              ]
            }
            if (query.type === 'CustomObject') {
              return [
                mockFileProperties({
                  type: 'CustomObject',
                  fullName: 'Account',
                }),
              ]
            }
            return []
          }),
        )
      })
      it('should return correct deleted elemIDs', async () => {
        const fetchResult = await testAdapter.fetch({
          ...mockFetchOpts,
          withChangesDetection: true,
        })
        expect(
          makeArray(fetchResult.partialFetchData?.deletedElements).map((id) =>
            id.getFullName(),
          ),
        ).toEqual([
          'salesforce.Layout.instance.DeletedLayout',
          'salesforce.ApexClass.instance.DeletedApex',
          'salesforce.Deleted__c',
        ])
      })
    })

    describe('client cache', () => {
      beforeEach(() => {
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {
              fetch: {
                optionalFeatures: {
                  fixRetrieveFilePaths: true,
                },
                metadata: {
                  include: [
                    { metadataType: '.*' },
                    { metadataType: 'ReportFolder', name: 'ReportFolder' },
                    {
                      metadataType: 'ReportFolder',
                      name: 'ReportFolder/NestedFolder',
                    },
                  ],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
          },
        }))
        // Mock Report & ReportFolder to make sure we don't cache their list calls
        mockMetadataTypes(
          [
            {
              xmlName: 'Report',
              directoryName: 'reports',
              inFolder: true,
              metaFile: true,
            },
            { xmlName: 'ReportFolder', directoryName: 'reports' },
          ],

          {
            parentField: {
              name: '',
              soapType: 'string',
              foreignKeyDomain: 'ReportFolder',
            },
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          {
            Report: [
              {
                props: {
                  fullName: 'TestReport',
                  fileName: 'reports/ReportsFolder/TestReport.report',
                },
                values: {
                  fullName: 'ReportsFolder/TestReport',
                },
              },
              {
                props: {
                  fullName: 'TestNestedReport',
                  fileName:
                    'reports/ReportsFolder/NestedFolder/TestNestedReport.report',
                },
                values: {
                  fullName: 'NestedFolder/TestNestedReport',
                },
              },
            ],
            ReportFolder: [
              {
                props: {
                  fullName: 'ReportsFolder',
                  fileName: 'reports/ReportsFolder',
                },
                values: {
                  fullName: 'ReportsFolder',
                },
              },
              {
                props: {
                  fullName: 'NestedFolder',
                  fileName: 'reports/ReportsFolder/NestedFolder',
                },
                values: {
                  fullName: 'NestedFolder',
                },
              },
            ],
          },
        )
      })
      describe('listMetadataObjects', () => {
        it('should cache listMetadataObjects calls that are not on Folders', async () => {
          await adapter.fetch(mockFetchOpts)
          const listedQueries = connection.metadata.list.mock.calls.flatMap(
            (args) => args[0],
          )
          const queriesByType = _.groupBy(listedQueries, (query) => query.type)
          const typesQueriedMoreThanOnce = Object.entries(queriesByType).reduce<
            string[]
          >(
            (acc, [type, queries]) =>
              queries.length > 1 ? acc.concat(type) : acc,
            [],
          )
          expect(typesQueriedMoreThanOnce).toEqual(['Report'])
        })
      })
    })

    it('should fetch basic metadata type', async () => {
      mockMetadataType(
        { xmlName: 'Flow' },
        {
          valueTypeFields: [
            {
              name: 'fullName',
              soapType: 'string',
              valueRequired: true,
            },
            {
              name: 'description',
              soapType: 'string',
              valueRequired: true,
            },
            {
              name: 'isTemplate',
              soapType: 'boolean',
              valueRequired: false,
            },
            {
              name: 'enum',
              soapType: 'SomeEnumType',
              picklistValues: [
                { value: 'yes', defaultValue: true, active: true },
                { value: 'no', defaultValue: false, active: true },
              ],
            },
          ],
        },
      )
      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const describeMock = connection.metadata
        .describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe(
        '{http://soap.sforce.com/2006/04/metadata}Flow',
      )
      const flow = findElements(result, 'Flow').pop() as ObjectType
      expect(flow.fields.description.refType.elemID.name).toBe('string')
      // TODO: remove comment when SALTO-45 will be resolved
      // expect(flow.fields.description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
      expect(flow.fields.isTemplate.refType.elemID.name).toBe('boolean')
      expect(
        flow.fields.isTemplate.annotations[CORE_ANNOTATIONS.REQUIRED],
      ).toBeFalsy()
      expect(flow.fields.enum.refType.elemID.name).toBe('string')
      expect(flow.fields.enum.annotations[CORE_ANNOTATIONS.DEFAULT]).toBe('yes')
      // Note the order here is important because we expect restriction values to be sorted
      expect(getRestriction(flow.fields.enum).values).toEqual(['no', 'yes'])
      expect(flow.path).toEqual([
        constants.SALESFORCE,
        constants.TYPES_PATH,
        'Flow',
      ])
      expect(
        isServiceId(
          await flow.fields[constants.INSTANCE_FULL_NAME_FIELD].getType(),
        ),
      ).toEqual(true)
      expect(
        isServiceId((await flow.getAnnotationTypes())[constants.METADATA_TYPE]),
      ).toEqual(true)
      expect(flow.annotations[constants.METADATA_TYPE]).toEqual('Flow')
    })

    it('should fetch folder metadata type', async () => {
      mockMetadataType(
        { xmlName: 'EmailTemplate', inFolder: true, metaFile: true },
        {
          parentField: {
            name: '',
            soapType: 'string',
            foreignKeyDomain: 'EmailFolder',
          },
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'name', soapType: 'string', valueRequired: false },
          ],
        },
      )
      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const describeMock = connection.metadata
        .describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe(
        '{http://soap.sforce.com/2006/04/metadata}EmailTemplate',
      )
      expect(describeMock.mock.calls[1][0]).toBe(
        '{http://soap.sforce.com/2006/04/metadata}EmailFolder',
      )
      const emailFolder = findElements(
        result,
        'EmailFolder',
      ).pop() as ObjectType
      expect(emailFolder.fields[constants.INTERNAL_ID_FIELD]).toBeDefined()
    })

    it('should fetch nested metadata types', async () => {
      mockMetadataType(
        { xmlName: 'NestingType' },
        {
          valueTypeFields: [
            {
              // Nested field with multiple subfields returns fields as array
              name: 'field',
              soapType: 'NestedType',
              fields: [
                {
                  name: 'nestedStr',
                  soapType: 'string',
                },
                {
                  name: 'nestedNum',
                  soapType: 'double',
                },
                {
                  name: 'doubleNested',
                  soapType: 'SingleFieldType',
                  fields: [
                    {
                      name: 'str',
                      soapType: 'string',
                    },
                  ],
                },
              ],
            },
            {
              // Nested field with a single subfield returns fields as an object
              name: 'otherField',
              soapType: 'SingleFieldType',
              fields: [
                {
                  name: 'str',
                  soapType: 'string',
                },
              ],
            },
          ],
        },
      )

      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const elementNames = result.map((x) => x.elemID.getFullName())
      expect(elementNames).toHaveLength(
        _.concat(
          Object.keys(Types.getAllFieldTypes()),
          Object.keys(Types.getAllMissingTypes()),
        ).length +
          2 /* LookupFilter & filter items */ +
          1 /* rollup summary operation */ +
          1 /* rollup summary filter type */ +
          1 /* rollup summary filter's operation type */ +
          3 +
          2 /* mask char & type */ +
          1 /* security classification */ +
          1 /* business status */ +
          1 /* treat blank as */ +
          1 /* value set */ +
          2 /* field dependency & value settings */ +
          7 /* range restrictions */ +
          2 /* ChangedAtSingleton type & instance */,
      )

      const elementsMap = _.keyBy(result, (element) =>
        element.elemID.getFullName(),
      )
      const nestingType = elementsMap['salesforce.NestingType'] as ObjectType
      const nestedType = elementsMap['salesforce.NestedType'] as ObjectType
      const singleField = elementsMap[
        'salesforce.SingleFieldType'
      ] as ObjectType
      expect(nestingType).toBeInstanceOf(ObjectType)
      expect(nestingType.fields.field.refType.elemID).toEqual(nestedType.elemID)
      expect(nestingType.fields.otherField.refType.elemID).toEqual(
        singleField.elemID,
      )
      expect(nestedType).toBeInstanceOf(ObjectType)
      expect(nestedType.fields.nestedStr.refType.elemID).toEqual(
        BuiltinTypes.STRING.elemID,
      )
      expect(nestedType.fields.nestedNum.refType.elemID).toEqual(
        BuiltinTypes.NUMBER.elemID,
      )
      expect(nestedType.fields.doubleNested.refType.elemID).toEqual(
        singleField.elemID,
      )
      expect(singleField).toBeInstanceOf(ObjectType)
      expect(singleField.fields.str.refType.elemID).toEqual(
        BuiltinTypes.STRING.elemID,
      )
    })

    describe('with metadata instance', () => {
      const mockFlowType = (): void => {
        mockMetadataType(
          { xmlName: 'Flow' },
          {
            valueTypeFields: [
              {
                name: 'bla',
                soapType: 'Bla',
                fields: [
                  {
                    name: 'bla',
                    soapType: 'double',
                  },
                  {
                    name: 'bla2',
                    soapType: 'boolean',
                  },
                  {
                    name: 'bla3',
                    soapType: 'boolean',
                  },
                ],
              },
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          [
            {
              props: {
                fullName: 'FlowInstance',
                fileName: 'flows/FlowInstance.flow',
              },
              values: {
                fullName: 'FlowInstance',
                bla: { bla: '55', bla2: 'false', bla3: 'true' },
              },
            },
            {
              props: {
                fullName: 'IgnoredNamespace__FlowInstance',
                fileName: 'flows/IgnoredNamespace__FlowInstance.flow',
                namespacePrefix: 'IgnoredNamespace',
              },
              values: {
                fullName: 'IgnoredNamespace__FlowInstance',
                bla: { bla: '55', bla2: 'false', bla3: 'true' },
              },
            },
            {
              props: {
                fullName: 'FlowInstanceNoId',
                fileName: 'flows/FlowInstanceNoId.flow',
                id: '',
              },
              values: {
                fullName: 'FlowInstanceNoId',
                bla: { bla: '55', bla2: 'false', bla3: 'true' },
              },
            },
          ],
        )
      }

      it('should fetch metadata instance', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(
          result,
          'Flow',
          'FlowInstance',
        ).pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(
          new ElemID(constants.SALESFORCE, 'Flow'),
        )
        expect(flow.value.bla.bla).toBe(55)
        expect(flow.value.bla.bla2).toBe(false)
        expect(flow.value.bla.bla3).toBe(true)
      })

      it('should add author annotations to metadata instance', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(
          result,
          'Flow',
          'FlowInstance',
        ).pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(
          new ElemID(constants.SALESFORCE, 'Flow'),
        )
        expect(flow.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual('test')
        expect(flow.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual(
          '2020-05-01T14:31:36.000Z',
        )
        expect(flow.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual('test')
        expect(flow.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual(
          '2020-05-01T14:41:36.000Z',
        )
      })

      it('should not have id field if id is empty string in fileProps', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(
          result,
          'Flow',
          'FlowInstanceNoId',
        ).pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(
          new ElemID(constants.SALESFORCE, 'Flow'),
        )
        expect(flow.value.id).toBeUndefined()
      })

      it('should not fetch excluded namespaces', async () => {
        const {
          connection: connectionMock,
          client: clientMock,
          adapter: adapterMock,
        } = mockAdapter({
          adapterParams: {
            config: {
              fetch: {
                metadata: {
                  exclude: [{ namespace: 'IgnoredNamespace' }],
                },
              },
            },
          },
        })
        connection = connectionMock
        mockFlowType()
        const spyReadMetadata = jest.spyOn(clientMock, 'readMetadata')
        await adapterMock.fetch(mockFetchOpts)
        expect(spyReadMetadata).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['IgnoredNamespace__FlowInstance']),
        )
        expect(spyReadMetadata).not.toHaveBeenCalledWith(
          expect.any(String),
          'IgnoredNamespace__FlowInstance',
        )
      })

      it('should not fetch metadata types instances the will be fetch in filters', async () => {
        const instances = [
          { props: { fullName: 'MyType0' }, values: { fullName: 'MyType0' } },
          { props: { fullName: 'MyType1' }, values: { fullName: 'MyType1' } },
        ]
        mockMetadataType(
          { xmlName: 'Queue' },
          {
            valueTypeFields: [
              { name: 'fullName', soapType: 'string', valueRequired: true },
            ],
          },
          instances,
        )
        await adapter.fetch(mockFetchOpts)
        expect(fetchMetadataInstancesSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            metadataType: expect.objectContaining({
              elemID: expect.objectContaining({ typeName: 'Queue' }),
            }),
          }),
        )
      })

      it('should use existing elemID when fetching metadata instance', async () => {
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: (
              adapterName: string,
              serviceIds: ServiceIds,
              name: string,
            ): ElemID =>
              new ElemID(
                adapterName,
                name === 'FlowInstance' &&
                serviceIds[constants.INSTANCE_FULL_NAME_FIELD] ===
                  'FlowInstance'
                  ? 'my_FlowInstance'
                  : name,
              ),
          },
        }))

        mockFlowType()

        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(
          result,
          'Flow',
          'my_FlowInstance',
        ).pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(
          new ElemID(constants.SALESFORCE, 'Flow'),
        )
        expect(flow.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
          'FlowInstance',
        )
      })

      it('should use default configured chunk size', async () => {
        const chunkSize = 3
        const type = 'MyType'
        const instances = [
          { props: { fullName: 'MyType0' }, values: { fullName: 'MyType0' } },
          { props: { fullName: 'MyType1' }, values: { fullName: 'MyType1' } },
          { props: { fullName: 'MyType2' }, values: { fullName: 'MyType2' } },
          { props: { fullName: 'MyType3' }, values: { fullName: 'MyType3' } },
        ]
        mockMetadataType(
          { xmlName: 'MyType' },
          {
            valueTypeFields: [
              { name: 'fullName', soapType: 'string', valueRequired: true },
            ],
          },
          instances,
        )
        const res = await adapter.fetch(mockFetchOpts)
        expect(res).toBeDefined()
        expect(connection.metadata.read).toHaveBeenNthCalledWith(
          1,
          type,
          instances.slice(0, chunkSize).map((e) => e.values.fullName),
        )
        expect(connection.metadata.read).toHaveBeenNthCalledWith(
          2,
          type,
          instances.slice(chunkSize).map((e) => e.values.fullName),
        )
      })
      it('should use overridden configured chunk size', async () => {
        const chunkSize = 2
        const type = 'Test'
        const instances = [
          { props: { fullName: 'Test0' }, values: { fullName: 'Test0' } },
          { props: { fullName: 'Test1' }, values: { fullName: 'Test1' } },
          { props: { fullName: 'Test2' }, values: { fullName: 'Test2' } },
          { props: { fullName: 'Test3' }, values: { fullName: 'Test3' } },
        ]
        mockMetadataType(
          { xmlName: 'Test' },
          {
            valueTypeFields: [
              { name: 'fullName', soapType: 'string', valueRequired: true },
            ],
          },
          instances,
        )
        const res = await adapter.fetch(mockFetchOpts)
        expect(res).toBeDefined()
        expect(connection.metadata.read).toHaveBeenNthCalledWith(
          1,
          type,
          instances.slice(0, chunkSize).map((e) => e.values.fullName),
        )
        expect(connection.metadata.read).toHaveBeenNthCalledWith(
          2,
          type,
          instances.slice(chunkSize).map((e) => e.values.fullName),
        )
      })
    })

    describe('with complicated metadata instance', () => {
      const LAYOUT_NAME = 'Order-Order Layout'
      const INSTALLED_PACKAGE_NAMESPACE_PREFIX = 'SBQQ'
      const INSTALLED_PACKAGE_LAYOUT_NAME =
        'SBQQ__SearchFilter__c-SearchFilter Layout'

      let fromRetrieveResultSpy: jest.SpyInstance

      const createLayoutInstance = (
        layoutName: string,
        namespacePrefix?: string,
      ): MockInstanceParams => ({
        props: {
          fullName: layoutName,
          fileName: `layouts/${layoutName}.layout`,
          namespacePrefix,
        },
        values: {
          fullName: layoutName,
          layoutSections: [
            {
              label: 'Description Information',
              layoutColumns: [
                { layoutItems: [{ behavior: 'Edit', field: 'Description' }] },
                { layoutItems: [{ behavior: 'Edit2', field: 'Description2' }] },
              ],
            },
            { label: 'Additional Information', layoutColumns: ['', ''] },
            { layoutColumns: ['', '', ''], style: 'CustomLinks' },
            { layoutColumns: '' },
          ],
          processMetadataValues: [
            { name: 'dataType', value: { stringValue: 'Boolean' } },
            { name: 'leftHandSideReferenceTo', value: '' },
            { name: 'leftHandSideReferenceTo2', value: { stringValue: '' } },
            {
              name: 'leftHandSideReferenceTo3',
              value: { stringValue: { $: { 'xsi:nil': 'true' } } },
            },
          ],
        },
      })

      beforeEach(() => {
        mockMetadataType(
          { xmlName: 'Layout' },
          {
            valueTypeFields: [
              { name: 'fullName', soapType: 'string', valueRequired: true },
              {
                fields: [
                  { name: 'label', soapType: 'string', valueRequired: true },
                  { name: 'style', soapType: 'string', valueRequired: false },
                  {
                    fields: [
                      {
                        fields: [
                          {
                            name: 'field',
                            soapType: 'string',
                            valueRequired: true,
                          },
                          {
                            name: 'behavior',
                            soapType: 'string',
                            valueRequired: true,
                          },
                        ],
                        name: 'layoutItems',
                        soapType: 'LayoutItem',
                        valueRequired: true,
                      },
                      {
                        name: 'reserved',
                        soapType: 'string',
                        valueRequired: true,
                      },
                    ],
                    name: 'layoutColumns',
                    soapType: 'LayoutColumn',
                    valueRequired: true,
                  },
                ],
                name: 'layoutSections',
                soapType: 'LayoutSection',
              },
              {
                fields: [
                  // This returns 'String' and not 'string' on purpose, we saw similar response.
                  { name: 'name', soapType: 'String', valueRequired: true },
                  {
                    fields: [
                      {
                        name: 'stringValue',
                        soapType: 'string',
                        valueRequired: true,
                      },
                    ],
                    name: 'value',
                    soapType: 'Value',
                    valueRequired: true,
                  },
                ],
                name: 'processMetadataValues',
                soapType: 'ProcessMetadataValue',
              },
            ],
          },
          [
            createLayoutInstance(LAYOUT_NAME),
            createLayoutInstance(
              INSTALLED_PACKAGE_LAYOUT_NAME,
              INSTALLED_PACKAGE_NAMESPACE_PREFIX,
            ),
          ],
        )
        fromRetrieveResultSpy = jest.spyOn(
          xmlTransformerModule,
          'fromRetrieveResult',
        )
        fromRetrieveResultSpy.mockResolvedValue([
          {
            file: mockFileProperties({
              type: 'Layout',
              fullName: LAYOUT_NAME,
              fileName: `layouts/${LAYOUT_NAME}.layout`,
            }),
            values: {
              fullName: LAYOUT_NAME,
              layoutSections: [
                {
                  label: 'Description Information',
                  layoutColumns: [
                    {
                      layoutItems: [{ behavior: 'Edit', field: 'Description' }],
                    },
                    {
                      layoutItems: [
                        { behavior: 'Edit2', field: 'Description2' },
                      ],
                    },
                  ],
                },
                { label: 'Additional Information', layoutColumns: ['', ''] },
                { layoutColumns: ['', '', ''], style: 'CustomLinks' },
                { layoutColumns: '' },
              ],
              processMetadataValues: [
                { name: 'dataType', value: { stringValue: 'Boolean' } },
                { name: 'leftHandSideReferenceTo', value: '' },
                {
                  name: 'leftHandSideReferenceTo2',
                  value: { stringValue: '' },
                },
                {
                  name: 'leftHandSideReferenceTo3',
                  value: { stringValue: { $: { 'xsi:nil': 'true' } } },
                },
              ],
            },
          },
        ])
      })

      it('should fetch complicated metadata instance', async () => {
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const layout = findElements(
          result,
          'Layout',
          'Order_Order_Layout@bs',
        ).pop() as InstanceElement
        expect(layout).toBeDefined()
        expect((await layout.getType()).elemID).toEqual(LAYOUT_TYPE_ID)
        expect(layout.value[constants.INSTANCE_FULL_NAME_FIELD]).toBe(
          LAYOUT_NAME,
        )
        expect(layout.value.layoutSections.length).toBe(4)
        expect(layout.value.layoutSections[0].label).toBe(
          'Description Information',
        )
        expect(
          layout.value.layoutSections[0].layoutColumns[0].layoutItems[0]
            .behavior,
        ).toBe('Edit')
        expect(
          layout.value.layoutSections[0].layoutColumns[1].layoutItems[0].field,
        ).toBe('Description2')
        expect(layout.value.layoutSections[1].label).toBe(
          'Additional Information',
        )
        expect(layout.value.layoutSections[2].style).toBe('CustomLinks')
        expect(
          (
            (await (
              (await (
                await layout.getType()
              ).fields.processMetadataValues.getType()) as ListType
            ).getInnerType()) as ObjectType
          ).fields.name.refType.elemID.name,
        ).toBe('string')
        expect(layout.value.processMetadataValues[1].name).toBe(
          'leftHandSideReferenceTo',
        )
        // empty objects should be omitted
        expect(layout.value.processMetadataValues[2].name).toBe(
          'leftHandSideReferenceTo2',
        )
        // empty strings should be kept
        expect(layout.value.processMetadataValues[2].value).toEqual({
          stringValue: '',
        })
        expect(layout.value.processMetadataValues[3].name).toBe(
          'leftHandSideReferenceTo3',
        )
        // nulls should be omitted
        expect(layout.value.processMetadataValues[3].value).toBeUndefined()

        // Validates `fromRetrieveResult` is called with correct file properties.
        expect(fromRetrieveResultSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.objectContaining({
              fileName: 'layouts/Order-Order Layout.layout',
              fullName: 'Order-Order Layout',
            }),
            expect.objectContaining({
              fileName:
                'layouts/SBQQ__SearchFilter__c-SBQQ__SearchFilter Layout.layout',
              fullName: 'SBQQ__SearchFilter__c-SBQQ__SearchFilter Layout',
            }),
          ]),
          expect.anything(),
          expect.anything(),
          true,
        )
      })
    })

    it('should fetch metadata types lists', async () => {
      mockMetadataType(
        { xmlName: 'Flow' },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string' },
            {
              name: 'listTest',
              soapType: 'ListTest',
              fields: [
                { name: 'editable', soapType: 'boolean' },
                { name: 'field', soapType: 'string' },
              ],
            },
          ],
        },
        [
          {
            props: { fullName: 'FlowInstance' },
            values: {
              fullName: 'FlowInstance',
              listTest: [
                { field: 'Field1', editable: 'true' },
                { field: 'Field2', editable: 'false' },
              ],
            },
          },
          {
            props: { fullName: 'FlowInstance2' },
            values: {
              fullName: 'FlowInstance2',
              listTest: { field: 'Field11', editable: 'true' },
            },
          },
        ],
      )

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const flow = findElements(
        result,
        'Flow',
        'FlowInstance',
      ).pop() as InstanceElement
      expect((await flow.getType()).elemID).toEqual(
        new ElemID(constants.SALESFORCE, 'Flow'),
      )
      expect(
        isListType(await (await flow.getType()).fields.listTest.getType()),
      ).toBeTruthy()

      expect(flow.elemID).toEqual(
        new ElemID(constants.SALESFORCE, 'Flow', 'instance', 'FlowInstance'),
      )
      expect(flow.value.listTest[0].field).toEqual('Field1')
      expect(flow.value.listTest[0].editable).toBe(true)
      expect(flow.value.listTest[1].field).toEqual('Field2')
      expect(flow.value.listTest[1].editable).toBe(false)

      const flow2 = findElements(
        result,
        'Flow',
        'FlowInstance2',
      ).pop() as InstanceElement
      expect(flow2.value.listTest[0].field).toEqual('Field11')
      expect(flow2.value.listTest[0].editable).toBe(true)
    })

    it('should fetch settings instance', async () => {
      mockMetadataType({ xmlName: 'Settings' }, { valueTypeFields: [] }, [
        {
          props: { fullName: 'Quote' },
          values: { fullName: 'Quote' },
        },
      ])

      await adapter.fetch(mockFetchOpts)

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', [
        'Quote',
      ])
    })

    it('should not fetch child metadata type', async () => {
      mockMetadataType(
        { xmlName: 'Base', childXmlNames: ['Child'] },
        { valueTypeFields: [] },
      )
      await adapter.fetch(mockFetchOpts)

      const describeMock = connection.metadata
        .describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls.length).toBe(1)
      expect(describeMock.mock.calls[0][0]).toBe(
        '{http://soap.sforce.com/2006/04/metadata}Base',
      )
    })

    it('should fetch metadata instances using retrieve in chunks', async () => {
      mockMetadataType(
        {
          xmlName: 'ApexClass',
          metaFile: true,
          suffix: 'cls',
          directoryName: 'classes',
        },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        _.times(testMaxItemsInRetrieveRequest * 2).map((index) => ({
          props: {
            fullName: `MyClass${index}`,
            fileName: `classes/MyClass${index}.cls`,
          },
          values: { fullName: `MyClass${index}` },
          zipFiles: [
            {
              path: `unpackaged/classes/MyClass${index}.cls-meta.xml`,
              content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>50.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
            },
            {
              path: `unpackaged/classes/MyClass${index}.cls`,
              content: `
public class MyClass${index} {
  public void printLog() {
    System.debug('Instance${index}');
  }'
}
`,
            },
          ],
        })),
      )
      const { elements: result } = await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(2)
      const [first] = findElements(
        result,
        'ApexClass',
        'MyClass0',
      ) as InstanceElement[]
      const [second] = findElements(
        result,
        'ApexClass',
        'MyClass1',
      ) as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'MyClass0',
      )
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'MyClass1',
      )
      expect(
        (await first.value.content.getContent())
          .toString()
          .includes('Instance0'),
      ).toBeTruthy()
      expect(
        (await second.value.content.getContent())
          .toString()
          .includes('Instance1'),
      ).toBeTruthy()
    })
    it('should fetch Profile metadata instances', async () => {
      mockMetadataTypes(
        [
          { xmlName: 'Profile', metaFile: false },
          { xmlName: 'PermissionSet', metaFile: false },
        ],
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
          ],
        },
        {
          Profile: [
            {
              props: { fullName: 'SomeProfile', fileName: 'SomeProfile' },
              values: { fullName: 'SomeProfile' },
              zipFiles: [
                {
                  path: 'unpackaged/SomeProfile',
                  content: `<?xml version="1.0" encoding="UTF-8"?>
                          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>57.0</apiVersion>
                          </Profile>`,
                },
              ],
            },
          ],
          PermissionSet: [
            {
              props: { fullName: 'PermissionSet' },
              values: { fullName: 'PermissionSet' },
              zipFiles: [
                {
                  path: 'unpackaged/PermissionSet',
                  content: `<?xml version="1.0" encoding="UTF-8"?>
                          <PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
                              <apiVersion>57.0</apiVersion>
                          </PermissionSet>`,
                },
              ],
            },
          ],
        },
      )
      const { elements: result } = await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(1)
      const [instance] = findElements(
        result,
        'Profile',
        'SomeProfile',
      ) as InstanceElement[]
      expect(instance.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'SomeProfile',
      )
    })
    it('should fetch metadata instances folders using retrieve', async () => {
      mockMetadataType(
        { xmlName: 'EmailTemplate', inFolder: true, metaFile: true },
        {
          parentField: {
            name: '',
            soapType: 'string',
            foreignKeyDomain: 'EmailFolder',
          },
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'name', soapType: 'string', valueRequired: false },
          ],
        },
        [
          {
            props: {
              fullName: 'MyFolder',
              fileName: 'email/MyFolder',
              type: 'EmailFolder',
            },
            values: { fullName: 'MyFolder' },
            zipFiles: [
              {
                path: 'unpackaged/email/MyFolder-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">
  <accessType>Public</accessType>
  <name>My folder</name>
  <publicFolderAccess>ReadWrite</publicFolderAccess>
</EmailFolder>
`,
              },
            ],
          },
        ],
      )

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const [testElem] = findElements(result, 'EmailFolder', 'MyFolder')
      const testInst = testElem as InstanceElement
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual([
        constants.SALESFORCE,
        constants.RECORDS_PATH,
        'EmailFolder',
        'MyFolder',
      ])
      expect(testInst.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'MyFolder',
      )
      expect(testInst.value.name).toEqual('My folder')
    })

    it('should fetch metadata instances with namespace using retrieve', async () => {
      const namespaceName = 'th_con_app'
      mockMetadataType(
        { xmlName: 'ApexPage', metaFile: true },
        { valueTypeFields: [{ name: 'content', soapType: 'string' }] },
        [
          {
            props: {
              fullName: 'th_con_app__ThHomepage',
              fileName: 'pages/th_con_app__ThHomepage.page',
              namespacePrefix: namespaceName,
            },
            values: { fullName: 'th_con_app__ThHomepage' },
            zipFiles: [
              {
                path: 'unpackaged/pages/th_con_app__ThHomepage.page-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>38.0</apiVersion>
  <availableInTouch>false</availableInTouch>
  <confirmationTokenRequired>false</confirmationTokenRequired>
  <label>ThHomepage</label>
</ApexPage>
`,
              },
              {
                path: 'unpackaged/pages/th_con_app__ThHomepage.page',
                content:
                  '<apex:page sidebar="false" standardStylesheets="false"/>',
              },
            ],
          },
        ],
      )

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const [testInst] = findElements(
        result,
        'ApexPage',
        'th_con_app__ThHomepage',
      )
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual([
        constants.SALESFORCE,
        constants.INSTALLED_PACKAGES_PATH,
        namespaceName,
        constants.RECORDS_PATH,
        'ApexPage',
        'th_con_app__ThHomepage',
      ])
    })

    it('should fetch metadata instances with namespace', async () => {
      const namespaceName = 'asd'
      mockMetadataType({ xmlName: 'Test' }, { valueTypeFields: [] }, [
        {
          props: { fullName: 'asd__Test', namespacePrefix: namespaceName },
          values: { fullName: `${namespaceName}__Test` },
        },
      ])

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual([
        constants.SALESFORCE,
        constants.INSTALLED_PACKAGES_PATH,
        namespaceName,
        constants.RECORDS_PATH,
        'Test',
        'asd__Test',
      ])
    })

    it('should fetch metadata instances with namespace when fullName already includes the namespace', async () => {
      const namespaceName = 'asd'
      mockMetadataType({ xmlName: 'Test' }, { valueTypeFields: [] }, [
        {
          props: {
            fullName: `${namespaceName}__Test`,
            namespacePrefix: namespaceName,
          },
          values: { fullName: `${namespaceName}__Test` },
        },
      ])

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual([
        constants.SALESFORCE,
        constants.INSTALLED_PACKAGES_PATH,
        namespaceName,
        constants.RECORDS_PATH,
        'Test',
        'asd__Test',
      ])
    })
    describe('when there are duplicate fullNames in the response from listMetadataObjects', () => {
      it('should fetch only the element once', async () => {
        mockMetadataType({ xmlName: 'Test2' }, { valueTypeFields: [] }, [
          {
            props: { fullName: 'Test' },
            values: { fullName: 'Test' },
          },
          {
            props: { fullName: 'Test' },
            values: { fullName: 'Test' },
          },
        ])
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const testInstances = findElements(result, 'Test2', 'Test')
        expect(connection.metadata.read).toHaveBeenCalled()
        expect(testInstances).toHaveLength(1)
      })
    })

    describe('when there is an empty id in retrieve response', () => {
      it('should not create instance with internalId', async () => {
        mockMetadataType({ xmlName: 'Account' }, { valueTypeFields: [] }, [
          {
            props: { fullName: 'Account', id: '' },
            values: { fullName: 'Account' },
          },
        ])
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const [testObject] = findElements(result, 'Account', 'Account') as [
          InstanceElement,
        ]
        expect(testObject).toBeDefined()
        expect(testObject.value.internalId).toBeUndefined()
      })
    })

    it('should not fail the fetch on instances too large', async () => {
      mockMetadataType(
        {
          xmlName: 'ApexClass',
          metaFile: true,
          suffix: 'cls',
          directoryName: 'classes',
        },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        [
          {
            props: {
              fullName: 'LargeClass',
              fileName: 'classes/LargeClass.cls',
            },
            values: { fullName: 'LargeClass' },
            zipFiles: [
              {
                path: 'unpackaged/classes/LargeClass.cls-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>50.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
              },
              {
                path: 'unpackaged/classes/LargeClass.cls',
                content: `
public class LargeClass} {
  public void printLog() {
    System.debug('LargeInstance');
  }'
}
`,
              },
            ],
          },
        ],
      )

      connection.metadata.retrieve.mockReset()
      connection.metadata.retrieve.mockReturnValue(
        mockRetrieveLocator({
          errorStatusCode: constants.RETRIEVE_SIZE_LIMIT_ERROR,
        }),
      )

      const { elements: result, updatedConfig: config } =
        await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(1)
      expect(findElements(result, 'ApexClass', 'LargeClass')).toBeEmpty()
      expect(config?.config[0]?.value.fetch.metadata.exclude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadataType: 'ApexClass',
            name: 'LargeClass',
          }),
        ]),
      )
    })

    it('should retry fetch with smaller batches if zip file is too large', async () => {
      connection.metadata.retrieve.mockReturnValueOnce(
        mockRetrieveLocator({
          errorStatusCode: constants.RETRIEVE_SIZE_LIMIT_ERROR,
        }),
      )

      mockMetadataType(
        {
          xmlName: 'ApexClass',
          metaFile: true,
          suffix: 'cls',
          directoryName: 'classes',
        },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        _.times(2).map((index) => ({
          props: {
            fullName: `LargeClass${index}`,
            fileName: `classes/LargeClass${index}.cls`,
          },
          values: { fullName: 'LargeClass' },
          zipFiles: [
            {
              path: `unpackaged/classes/LargeClass${index}.cls-meta.xml`,
              content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>50.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
            },
            {
              path: `unpackaged/classes/LargeClass${index}.cls`,
              content: `
public class LargeClass${index} {
  public void printLog() {
    System.debug('LargeClass${index}');
  }'
}
`,
            },
          ],
        })),
        1,
      )

      const { elements: result, updatedConfig: config } =
        await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(3)
      const [first] = findElements(
        result,
        'ApexClass',
        'LargeClass0',
      ) as InstanceElement[]
      const [second] = findElements(
        result,
        'ApexClass',
        'LargeClass1',
      ) as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'LargeClass0',
      )
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(
        'LargeClass1',
      )
      expect(config?.config[0]?.value.fetch.metadata.exclude).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadataType: 'ApexClass',
          }),
        ]),
      )
    })

    describe('should not fetch SkippedList metadata types, instance and folders', () => {
      let result: FetchResult
      let elements: Element[] = []
      beforeEach(async () => {
        connection.describeGlobal.mockImplementation(async () => ({
          sobjects: [],
        }))
        connection.metadata.describe.mockResolvedValue(
          mockDescribeResult([
            { xmlName: 'Test1' },
            { xmlName: 'Test2' },
            { xmlName: 'Test3' },
            { xmlName: 'Report', inFolder: true },
          ]),
        )
        connection.metadata.describeValueType.mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Test1')) {
              throw new Error('fake error')
            }
            if (typeName.endsWith('Report')) {
              return mockDescribeValueResult({
                parentField: {
                  name: '',
                  soapType: 'string',
                  foreignKeyDomain: 'ReportFolder',
                },
                valueTypeFields: [],
              })
            }
            return mockDescribeValueResult({ valueTypeFields: [] })
          },
        )
        connection.metadata.list.mockImplementation(async (inQuery) => {
          const query = collections.array.makeArray(inQuery)[0]
          if (_.isEqual(query, { type: 'Report', folder: 'skip' })) {
            throw new Error('fake error')
          }
          const fullName = query.type === 'ReportFolder' ? 'skip' : 'instance1'
          return [mockFileProperties({ fullName, type: query.type })]
        })
        connection.metadata.read.mockImplementation(
          async (typeName: string, fullNames: string | string[]) => {
            if (typeName === 'Test2') {
              throw new Error('fake error')
            }
            return {
              fullName: Array.isArray(fullNames) ? fullNames[0] : fullNames,
            }
          },
        )

        result = await adapter.fetch(mockFetchOpts)
        elements = result.elements
      })

      it('should not consist config changes', () => {
        expect(result.updatedConfig).toBeUndefined()
      })

      it('should skip SkippedList types', () => {
        expect(findElements(elements, 'Test1')).toHaveLength(0)
        expect(findElements(elements, 'Test2')).toHaveLength(1)
        expect(findElements(elements, 'Test3')).toHaveLength(1)
      })

      it('should skip SkippedList instances', () => {
        expect(findElements(elements, 'Test2', 'instance1')).toHaveLength(0)
        expect(findElements(elements, 'Test3', 'instance1')).toHaveLength(1)
        expect(findElements(elements, 'Report', 'instance1')).toHaveLength(0)
      })
    })

    describe('should not fetch SkippedList retrieve instance', () => {
      let result: Element[] = []
      beforeEach(async () => {
        mockMetadataType(
          { xmlName: 'AssignmentRules' },
          { valueTypeFields: [] },
          [
            {
              props: {
                fullName: 'MyRules',
                fileName: 'assignmentRules/MyRules.rules',
              },
              values: { fullName: 'MyRules' },
              zipFiles: [
                {
                  path: 'unpackaged/assignmentRules/MyRules.rules',
                  content: `
<?xml version="1.0" encoding="UTF-8"?>
<AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata">
  <dummy>true</dummy>
</ApexPage>
`,
                },
              ],
            },
          ],
        )

        result = (await adapter.fetch(mockFetchOpts)).elements
      })

      it('should skip SkippedList retrieve instances', () => {
        expect(
          findElements(
            result,
            'EmailTemplate',
            'MyFolder_MyEmailTemplateSkippedList',
          ),
        ).toHaveLength(0)
      })
    })

    describe('should return errors when fetch on certain instances failed', () => {
      let result: FetchResult
      let config: InstanceElement

      const mockFailures = (
        connectionMock: MockInterface<Connection>,
      ): void => {
        connectionMock.describeGlobal.mockImplementation(async () => ({
          sobjects: [],
        }))
        connectionMock.metadata.describe.mockResolvedValue(
          mockDescribeResult([
            { xmlName: 'MetadataTest1' },
            { xmlName: 'MetadataTest2' },
            { xmlName: 'InstalledPackage' },
            { xmlName: 'Report', inFolder: true },
          ]),
        )
        connectionMock.metadata.describeValueType.mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Report')) {
              return mockDescribeValueResult({
                parentField: {
                  name: '',
                  soapType: 'string',
                  foreignKeyDomain: 'ReportFolder',
                },
                valueTypeFields: [],
              })
            }
            return mockDescribeValueResult({ valueTypeFields: [] })
          },
        )
        connectionMock.metadata.list.mockImplementation(async (inQuery) => {
          const query = collections.array.makeArray(inQuery)[0]
          const { type } = query
          if (type === 'MetadataTest2') {
            throw new SFError('sf:UNKNOWN_EXCEPTION')
          }
          const fullNames: Record<string, string> = {
            MetadataTest1: 'instance1',
            InstalledPackage: 'instance2',
          }
          const fullName = fullNames[type]
          return fullName === undefined
            ? []
            : [mockFileProperties({ fullName, type })]
        })
        connectionMock.metadata.read.mockRejectedValue(
          new SFError('sf:UNKNOWN_EXCEPTION'),
        )

        connectionMock.metadata.retrieve.mockReturnValue(
          mockRetrieveLocator({
            messages: [
              {
                fileName: 'unpackaged/package.xml',
                problem:
                  'Metadata API received improper input.' +
                  'Please ensure file name and capitalization is correct.' +
                  'Load of metadata from db failed for metadata of ' +
                  'type:InstalledPackage and file name:Test2.',
              },
            ],
          }),
        )
      }

      it('should return correct config when orig config has values', async () => {
        mockFailures(connection)
        result = await adapter.fetch(mockFetchOpts)
        config = result?.updatedConfig?.config[0] as InstanceElement
        expect(config).toBeDefined()
        expect(config.value).toEqual({
          fetch: {
            metadata: {
              exclude: [
                ...metadataExclude,
                { metadataType: 'InstalledPackage', name: 'Test2' },
                { metadataType: 'MetadataTest1', name: 'instance1' },
                { metadataType: 'MetadataTest2' },
              ],
            },
          },
          client: {
            readMetadataChunkSize: {
              default: 3,
              overrides: { Test: 2 },
            },
          },
          [MAX_ITEMS_IN_RETRIEVE_REQUEST]: testMaxItemsInRetrieveRequest,
        })
      })
      it('should return correct config when original config is empty', async () => {
        const { connection: connectionMock, adapter: adapterMock } =
          mockAdapter({
            adapterParams: {
              getElemIdFunc: mockGetElemIdFunc,
              config: {},
            },
          })
        mockFailures(connectionMock)

        result = await adapterMock.fetch(mockFetchOpts)
        config = result?.updatedConfig?.config[0] as InstanceElement
        expect(config.value).toEqual({
          fetch: {
            metadata: {
              exclude: [
                { metadataType: 'InstalledPackage', name: 'Test2' },
                { metadataType: 'MetadataTest1', name: 'instance1' },
                { metadataType: 'MetadataTest2' },
              ],
            },
          },
        })
      })
    })
    describe('with types with more than maxInstancesPerType instances', () => {
      const metadataType = {
        annotations: { apiName: 'test' },
        elemID: {
          name: 'test',
          createNestedID: jest.fn(),
          getFullName: jest.fn(),
          isTopLevel: jest.fn(),
        },
      } as unknown as ObjectType
      const metadataQuery = {
        isTypeMatch: jest.fn(),
        isInstanceIncluded: () => true,
        isInstanceMatch: () => true,
        isPartialFetch: () => false,
        isTargetedFetch: jest.fn(),
        isFetchWithChangesDetection: jest.fn(),
        getFolderPathsByName: jest.fn(),
        logData: jest.fn(),
      }
      const excludeFilePropMock = mockFileProperties({
        fullName: 'fullName',
        type: 'excludeMe',
      })
      const includeFilePropMock = mockFileProperties({
        fullName: 'fullName',
        type: 'includeMe',
      })

      const MOCK_METADATA_LENGTH = 5
      const { client } = mockAdapter()

      const fetchResult = (
        fileProps: FileProperties[],
        maxInstancesPerType: number,
      ): Promise<FetchElements<InstanceElement[]>> =>
        fetchMetadataInstances({
          client,
          metadataType,
          metadataQuery,
          fileProps,
          maxInstancesPerType,
        })

      beforeAll(() => {
        client.readMetadata = jest.fn().mockResolvedValue({
          result: new Array(MOCK_METADATA_LENGTH).fill(includeFilePropMock),
          errors: [],
          configSuggestions: [],
        })
        metadataType.elemID.isTopLevel = jest.fn().mockReturnValue(true)
      })

      it('should not fetch the types with many instances and add them to the exclude list', async () => {
        const excludeFilePropMocks = new Array(3).fill(excludeFilePropMock)
        const includeFilePropMocks = new Array(2).fill(includeFilePropMock)

        const excludeFetchResult = await fetchResult(excludeFilePropMocks, 2)
        const includeFetchResult = await fetchResult(includeFilePropMocks, 2)

        expect(excludeFetchResult.elements.length).toBe(0)
        expect(excludeFetchResult.configChanges.length).toBe(1)
        expect(excludeFetchResult.configChanges[0]).toMatchObject({
          type: 'metadataExclude',
          value: {
            metadataType: 'excludeMe',
          },
          reason:
            "'excludeMe' has 3 instances so it was skipped and would be excluded from future fetch operations, as maxInstancesPerType is set to 2.\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (-1 for unlimited).",
        })

        // Make sure the api call was sent and that nothing was added to exclude
        expect(includeFetchResult.elements.length).toBe(MOCK_METADATA_LENGTH)
        expect(includeFetchResult.configChanges.length).toBe(0)
      })
    })

    describe('with InFolderMetadataType instance', () => {
      let toRetrieveRequestSpy: jest.SpyInstance

      beforeEach(async () => {
        toRetrieveRequestSpy = jest.spyOn(
          xmlTransformerModule,
          'toRetrieveRequest',
        )
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {
              fetch: {
                optionalFeatures: {
                  fixRetrieveFilePaths: true,
                },
                metadata: {
                  include: [
                    { metadataType: '.*' },
                    { metadataType: 'ReportFolder', name: 'ReportFolder' },
                    {
                      metadataType: 'ReportFolder',
                      name: 'ReportFolder/NestedFolder',
                    },
                  ],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
          },
        }))

        mockMetadataTypes(
          [
            { xmlName: 'Report', directoryName: 'reports' },
            { xmlName: 'ReportFolder', directoryName: 'reports' },
          ],

          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          {
            Report: [
              {
                props: {
                  fullName: 'TestReport',
                  fileName: 'reports/ReportsFolder/TestReport.report',
                },
                values: {
                  fullName: 'ReportsFolder/TestReport',
                },
              },
              {
                props: {
                  fullName: 'TestNestedReport',
                  fileName:
                    'reports/ReportsFolder/NestedFolder/TestNestedReport.report',
                },
                values: {
                  fullName: 'NestedFolder/TestNestedReport',
                },
              },
            ],
            ReportFolder: [
              {
                props: {
                  fullName: 'ReportsFolder',
                  fileName: 'reports/ReportsFolder',
                },
                values: {
                  fullName: 'ReportsFolder',
                },
              },
              {
                props: {
                  fullName: 'NestedFolder',
                  fileName: 'reports/ReportsFolder/NestedFolder',
                },
                values: {
                  fullName: 'NestedFolder',
                },
              },
            ],
          },
        )
        await adapter.fetch(mockFetchOpts)
      })
      it('should fetch instances of both the FolderMetadataType and InFolderMetadataType', () => {
        expect(toRetrieveRequestSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fileName: 'reports/ReportsFolder/TestReport.report',
              fullName: 'TestReport',
              type: 'Report',
            }),
            expect.objectContaining({
              fileName:
                'reports/ReportsFolder/NestedFolder/TestNestedReport.report',
              fullName: 'TestNestedReport',
              type: 'Report',
            }),
            expect.objectContaining({
              fileName: 'reports/ReportsFolder',
              fullName: 'ReportsFolder',
              type: 'ReportFolder',
            }),
            expect.objectContaining({
              fileName: 'reports/ReportsFolder/NestedFolder',
              fullName: 'NestedFolder',
              type: 'ReportFolder',
            }),
          ]),
        )
      })
    })

    describe('when fetching Workflow instance on CustomObject', () => {
      let result: FetchResult
      beforeEach(async () => {
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {
              fetch: {
                optionalFeatures: {
                  fixRetrieveFilePaths: true,
                },
                metadata: {
                  include: [{ metadataType: '.*' }],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
          },
        }))
        mockMetadataTypes(
          [{ xmlName: 'Workflow', directoryName: 'workflows' }],

          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          {
            Workflow: [
              {
                props: {
                  fullName: 'TestObject__c',
                  fileName: 'Workflow/TestObject__c.workflow',
                },
                values: {
                  fullName: 'TestObject__c',
                },
                zipFiles: [
                  {
                    path: 'unpackaged/workflows/TestObject__c.workflow',
                    content: `
                      <?xml version="1.0" encoding="UTF-8"?>
                      <Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
                        <apiVersion>58.0</apiVersion>
                        <fullName>TestObject__c</fullName>
                        <alerts>
                          <fullName>TestAlert1</fullName>
                        </alerts>
                        <alerts>
                          <fullName>TestAlert2</fullName>
                        </alerts>
                      </Workflow>`,
                  },
                ],
              },
            ],
          },
        )
        result = await adapter.fetch(mockFetchOpts)
      })
      it('should fetch sub instances of Workflow', () => {
        expect(
          result.elements
            .filter(isInstanceElement)
            .map((instance) => apiNameSync(instance)),
        ).toIncludeAllMembers([
          'TestObject__c.TestAlert1',
          'TestObject__c.TestAlert2',
        ])
      })
    })

    describe('with error that creates config suggestions', () => {
      const ROLE_INSTANCE_NAMES = ['CEO', 'JiraAdmin']
      const FAILING_ROLE_INSTANCE_NAMES = ['SalesforceAdmin', 'ProductManager']
      beforeEach(() => {
        mockMetadataType(
          { xmlName: 'Role', directoryName: 'roles' },
          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          [
            {
              props: {
                fullName: 'CEO',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'CEO',
              },
            },
            {
              props: {
                fullName: 'JiraAdmin',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'JiraAdmin',
              },
            },
            {
              props: {
                fullName: 'SalesforceAdmin',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'SalesforceAdmin',
              },
            },
            {
              props: {
                fullName: 'ProductManager',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'ProductManager',
              },
            },
          ],
        )
      })
      describe.each([
        new Error(SOCKET_TIMEOUT),
        Object.assign(new Error(INVALID_CROSS_REFERENCE_KEY), {
          errorCode: INVALID_CROSS_REFERENCE_KEY,
        }),
        ...NON_TRANSIENT_SALESFORCE_ERRORS.map(
          (errorName) => new SFError(errorName),
        ),
      ])('when client throws %p', (thrownError) => {
        beforeEach(() => {
          connection.metadata.read.mockImplementation(
            async (_typeName, fullNames) => {
              const names = makeArray(fullNames)
              const [instanceName] = names
              if (names.length > 1) {
                throw thrownError
              }
              if (FAILING_ROLE_INSTANCE_NAMES.includes(instanceName)) {
                throw thrownError
              }
              return {
                fullName: instanceName,
              }
            },
          )
        })
        it('should create config suggestions for instances that failed', async () => {
          const fetchResult = await adapter.fetch(mockFetchOpts)
          const expectedMetadataExcludes = FAILING_ROLE_INSTANCE_NAMES.map(
            (instanceName) =>
              expect.objectContaining({
                metadataType: 'Role',
                name: instanceName,
              }),
          )
          expect(
            fetchResult?.updatedConfig?.config[0].value.fetch.metadata.exclude,
          ).toEqual(expect.arrayContaining(expectedMetadataExcludes))
          const fetchedInstancesNames = await awu(fetchResult.elements)
            .filter(isInstanceOfType('Role'))
            .map((instance) => apiName(instance))
            .toArray()
          expect(fetchedInstancesNames).toEqual(ROLE_INSTANCE_NAMES)
        })
      })
    })
    describe('when org has a namespace defined', () => {
      const TEST_TYPE_NAME = 'TestType'
      const ORG_NAMESPACE = 'test'
      const INSTALLED_PACKAGE_NAMESPACE = 'SBQQ'

      let fromRetrieveResultSpy: jest.SpyInstance

      beforeEach(() => {
        ;({ connection, adapter } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            metadataToRetrieve: [TEST_TYPE_NAME],
            config: {
              fetch: {
                metadata: {
                  include: [{ metadataType: '.*' }],
                },
              },
              maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
              client: {
                readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
              },
            },
          },
        }))
        fromRetrieveResultSpy = jest.spyOn(
          xmlTransformerModule,
          'fromRetrieveResult',
        )
        fromRetrieveResultSpy.mockResolvedValue([])
        mockMetadataType(
          { xmlName: TEST_TYPE_NAME, directoryName: 'tests', suffix: 'test' },
          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          [
            {
              props: {
                fullName: 'OrgInstance',
                fileName: 'tests/OrgInstance.test',
                namespacePrefix: ORG_NAMESPACE,
              },
              values: {
                fullName: 'OrgInstance',
              },
            },
            {
              props: {
                fullName: 'InstalledInstance',
                fileName: 'tests/InstalledInstance.test',
                namespacePrefix: INSTALLED_PACKAGE_NAMESPACE,
              },
              values: {
                fullName: `${INSTALLED_PACKAGE_NAMESPACE}__InstalledInstance`,
              },
            },
          ],
          undefined,
          ORG_NAMESPACE,
        )
      })
      it('should modify only the file properties of instances from installed package', async () => {
        await adapter.fetch(mockFetchOpts)
        expect(fromRetrieveResultSpy).toHaveBeenCalledTimes(1)
        expect(fromRetrieveResultSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            // unmodified file properties of instance from the org namespace
            expect.objectContaining({
              fileName: 'tests/OrgInstance.test',
              fullName: 'OrgInstance',
            }),
            // modified file properties of instance from the installed package namespace
            expect.objectContaining({
              fileName: `tests/${INSTALLED_PACKAGE_NAMESPACE}__InstalledInstance.test`,
              fullName: `${INSTALLED_PACKAGE_NAMESPACE}__InstalledInstance`,
            }),
          ]),
          expect.anything(),
          expect.anything(),
          true,
        )
      })
    })
  })
})

describe('Fetch via retrieve API', () => {
  let connection: MockInterface<Connection>
  let client: SalesforceClient

  type MockInstanceDef = {
    type: MetadataObjectType
    instanceName: string
    failRetrieve?: boolean
  }

  const updateProfileZipFileContents = (
    zipFile: ZipFile,
    fileProps: FileProperties[],
  ): void => {
    const customObjectTypes = [
      ...new Set(
        fileProps
          .filter((fileProp) => fileProp.type === CUSTOM_OBJECT)
          .map((fileProp) => fileProp.fullName),
      ),
    ]
    zipFile.content = `<?xml version="1.0" encoding="UTF-8"?>
          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
              <custom>false</custom>`
    customObjectTypes.forEach((type) => {
      zipFile.content += `<fieldPermissions>
        <editable>true</editable>
        <field>${type}.SomeField</field>
        <readable>true</readable>
    </fieldPermissions>`
    })
    zipFile.content += '</Profile>'
  }

  const createFilePath = (fileName: string, type: MetadataObjectType): string =>
    `unpackaged/${fileName}${type.annotations.hasMetaFile ? '-meta.xml' : ''}`

  const generateMockData = (
    instanceDefs: MockInstanceDef[],
  ): { fileProps: FileProperties[]; zipFiles: ZipFile[] } => {
    const fileProps = instanceDefs.map(({ type, instanceName }) =>
      mockFileProperties({
        type: type.elemID.typeName,
        fullName: instanceName,
      }),
    )

    const zipFiles = _.zip(fileProps, instanceDefs).map(
      ([fileProp, instanceDef]) => {
        if (fileProp === undefined || instanceDef === undefined) {
          // can't happen
          return { path: '', content: '' }
        }
        return {
          path: createFilePath(fileProp.fileName, instanceDef.type),
          content: `<?xml version="1.0" encoding="UTF-8"?>
          <${fileProp.type} xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
          </${fileProp.type}>`,
        }
      },
    )
    return {
      fileProps,
      zipFiles,
    }
  }

  const setupMocks = async (mockDefs: MockInstanceDef[]): Promise<void> => {
    const successfulMockDefs = mockDefs.filter((def) => !def.failRetrieve)
    const { fileProps, zipFiles } = generateMockData(successfulMockDefs)
    connection.metadata.list.mockImplementation(async (inputQueries) => {
      const queries = Array.isArray(inputQueries)
        ? inputQueries
        : [inputQueries]
      return _(queries)
        .map((query) =>
          fileProps.filter((fileProp) => fileProp.type === query.type),
        )
        .flatten()
        .value()
    })
    zipFiles
      .filter((zipFile) => zipFile.content.includes('</Profile>'))
      .forEach((zipFile) => updateProfileZipFileContents(zipFile, fileProps))
    connection.metadata.retrieve.mockReturnValue(
      mockRetrieveLocator(
        mockRetrieveResult({
          messages: mockDefs
            .filter((def) => def.failRetrieve)
            .map((def) =>
              mockFileProperties({
                type: def.type.elemID.typeName,
                fullName: def.instanceName,
              }),
            )
            .map(({ fileName, fullName, type }) => ({
              fileName,
              problem: `Load of metadata from db failed for metadata of type:${type} and file name:${fullName}.`,
            })),
          zipFiles,
        }),
      ),
    )
  }

  beforeEach(async () => {
    ;({ connection, client } = createMockClient())
  })

  describe('Single regular instance', () => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([
        { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
      ])

      elements = (
        await retrieveMetadataInstances({
          client,
          types: [mockTypes.ApexClass],
          fetchProfile: buildFetchProfile({
            fetchParams: { addNamespacePrefixToFullName: false },
          }),
        })
      ).elements
    })

    it('should fetch the correct instances', () => {
      expect(elements).toHaveLength(1)
      expect(elements[0].elemID).toEqual(
        new ElemID(SALESFORCE, 'ApexClass', 'instance', 'SomeApexClass'),
      )
    })
  })

  describe.each([DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST, 1])(
    'Chunks of regular instances [chunk size = $chunkSize]',
    (chunkSize) => {
      let elements: InstanceElement[] = []

      beforeEach(async () => {
        await setupMocks([
          { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
          { type: mockTypes.CustomObject, instanceName: 'Account' },
        ])

        elements = (
          await retrieveMetadataInstances({
            client,
            types: [mockTypes.ApexClass, mockTypes.CustomObject],
            fetchProfile: buildFetchProfile({
              fetchParams: { addNamespacePrefixToFullName: false },
              maxItemsInRetrieveRequest: chunkSize,
            }),
          })
        ).elements
      })

      it('should fetch the correct instances', () => {
        expect(elements).toHaveLength(2)
        expect(elements).toIncludeAllPartialMembers([
          {
            elemID: new ElemID(
              SALESFORCE,
              'ApexClass',
              'instance',
              'SomeApexClass',
            ),
          },
          {
            elemID: new ElemID(
              SALESFORCE,
              'CustomObject',
              'instance',
              'Account',
            ),
          },
        ])
      })
    },
  )

  describe.each([DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST, 2])(
    'chunks with one profile [chunk size = %d]',
    (chunkSize) => {
      let elements: InstanceElement[] = []

      beforeEach(async () => {
        await setupMocks([
          { type: mockTypes.CustomObject, instanceName: 'Case' },
          { type: mockTypes.CustomObject, instanceName: 'Account' },
          { type: mockTypes.Profile, instanceName: 'SomeProfile' },
        ])

        elements = (
          await retrieveMetadataInstances({
            client,
            types: [mockTypes.CustomObject, mockTypes.Profile],
            fetchProfile: buildFetchProfile({
              fetchParams: { addNamespacePrefixToFullName: false },
              maxItemsInRetrieveRequest: chunkSize,
            }),
          })
        ).elements
      })

      it('should fetch the correct instances including a complete profile', () => {
        expect(elements).toHaveLength(3)
        expect(elements).toIncludeAllPartialMembers([
          {
            elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Case'),
          },
          {
            elemID: new ElemID(
              SALESFORCE,
              'CustomObject',
              'instance',
              'Account',
            ),
          },
          {
            elemID: new ElemID(
              SALESFORCE,
              'Profile',
              'instance',
              'SomeProfile',
            ),
          },
        ])
        const profileInstance = elements[2]
        expect(profileInstance.value.fieldPermissions).not.toBeEmpty()
        const referencedTypes = _(profileInstance.value.fieldPermissions)
          .map(({ field }: { field: string }) => field.split('.')[0])
          .sortBy()
          .value()

        expect(referencedTypes).toEqual(['Account', 'Case'])
      })
    },
  )

  describe('Multiple chunks with multiple profiles', () => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
        { type: mockTypes.Profile, instanceName: 'SomeOtherProfile' },
      ])

      elements = (
        await retrieveMetadataInstances({
          client,
          types: [mockTypes.CustomObject, mockTypes.Profile],
          fetchProfile: buildFetchProfile({
            fetchParams: { addNamespacePrefixToFullName: false },
            maxItemsInRetrieveRequest: 3,
          }),
        })
      ).elements
    })

    it('should fetch the correct instances including both complete profiles', () => {
      expect(elements).toHaveLength(4)
      expect(elements).toIncludeAllPartialMembers([
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Case') },
        {
          elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Account'),
        },
        {
          elemID: new ElemID(SALESFORCE, 'Profile', 'instance', 'SomeProfile'),
        },
        {
          elemID: new ElemID(
            SALESFORCE,
            'Profile',
            'instance',
            'SomeOtherProfile',
          ),
        },
      ])
      const profileInstances = elements.slice(2)
      profileInstances.forEach((profileInstance) => {
        expect(profileInstance.value.fieldPermissions).not.toBeEmpty()
        const referencedTypes = _(profileInstance.value.fieldPermissions)
          .map(({ field }: { field: string }) => field.split('.')[0])
          .sortBy()
          .value()
        expect(referencedTypes).toEqual(['Account', 'Case'])
      })
    })
  })

  describe('Config changes', () => {
    let configChanges: ConfigChangeSuggestion[]

    beforeEach(async () => {
      await setupMocks([
        {
          type: mockTypes.ApexClass,
          instanceName: 'SomeApexClass',
        },
        {
          type: mockTypes.ApexClass,
          instanceName: 'ExcludedApexClass',
          failRetrieve: true,
        },
      ])
    })

    describe('When retrieve fails', () => {
      beforeEach(async () => {
        const fetchProfile = buildFetchProfile({
          fetchParams: {
            addNamespacePrefixToFullName: false,
          },
        })

        configChanges = (
          await retrieveMetadataInstances({
            client,
            types: [mockTypes.ApexClass],
            fetchProfile,
          })
        ).configChanges
      })
      it('Should create a config change for exclusion', () => {
        expect(configChanges).toEqual([
          expect.objectContaining({
            type: 'metadataExclude',
            value: {
              metadataType: 'ApexClass',
              name: 'ExcludedApexClass',
            },
          }),
        ])
      })
    })
    describe('When retrieve fails for an excluded instance', () => {
      beforeEach(async () => {
        const fetchProfile = buildFetchProfile({
          fetchParams: {
            addNamespacePrefixToFullName: false,
            metadata: {
              exclude: [
                {
                  metadataType: 'ApexClass',
                  name: 'ExcludedApexClass',
                },
              ],
            },
          },
        })

        configChanges = (
          await retrieveMetadataInstances({
            client,
            types: [mockTypes.ApexClass],
            fetchProfile,
          })
        ).configChanges
      })
      it('Should not create a config change', () => {
        // TODO change this to expect no config changes once configChangeAlreadyExists is changed
        expect(configChanges).toEqual([
          expect.objectContaining({
            type: 'metadataExclude',
            value: {
              metadataType: 'ApexClass',
              name: 'ExcludedApexClass',
            },
          }),
        ])
      })
    })
  })
})
