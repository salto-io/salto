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
import { Value } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import {
  IdentityInfo,
  DeployMessage,
  Field as SalesforceField,
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
} from '@salto-io/jsforce'
import {
  MetadataObject,
  DescribeMetadataResult,
  ValueTypeField,
  DescribeValueTypeResult,
  FileProperties,
  RetrieveResult,
  RetrieveResultLocator,
  DeployResultLocator,
  DeployResult,
  QueryResult,
} from '@salto-io/jsforce-types'
import Connection, {
  Metadata,
  Soap,
  Bulk,
  Tooling,
  RunTestsResult,
  RunTestFailure,
} from '../src/client/jsforce'
import { createEncodedZipContent, ZipFile } from './utils'

export const MOCK_INSTANCE_URL = 'https://url.com/'

export type MockDescribeResultInput = Pick<MetadataObject, 'xmlName'> &
  Partial<MetadataObject>
export const mockDescribeResult = (
  objects: MockDescribeResultInput[],
  organizationNamespace = '',
): DescribeMetadataResult => ({
  metadataObjects: objects.map((props) => ({
    childXmlNames: [],
    directoryName: _.lowerCase(props.xmlName),
    inFolder: false,
    metaFile: false,
    suffix: '.file',
    ...props,
  })),
  organizationNamespace,
  testRequired: false,
  partialSaveAllowed: true,
})

export type MockValueTypeFieldInput = Pick<
  ValueTypeField,
  'name' | 'soapType'
> &
  Partial<
    Omit<ValueTypeField, 'fields'> & { fields: MockValueTypeFieldInput[] }
  >

export const mockValueTypeField = (
  props: MockValueTypeFieldInput,
): ValueTypeField => ({
  foreignKeyDomain: props.foreignKeyDomain ?? '',
  isForeignKey: props.isForeignKey ?? false,
  isNameField: false,
  minOccurs: 0,
  picklistValues: [],
  valueRequired: false,
  ...props,
  fields:
    props.fields === undefined ? [] : props.fields.map(mockValueTypeField),
})

export type MockDescribeValueResultInput = Partial<
  Omit<DescribeValueTypeResult, 'valueTypeFields' | 'parentField'>
> & {
  parentField?: MockValueTypeFieldInput
  valueTypeFields: MockValueTypeFieldInput[]
}

export const mockDescribeValueResult = (
  props: MockDescribeValueResultInput,
): DescribeValueTypeResult => ({
  apiCreatable: true,
  apiDeletable: true,
  apiReadable: true,
  apiUpdatable: true,
  ...props,
  parentField:
    props.parentField === undefined
      ? (undefined as unknown as ValueTypeField) // The type says this is required but it isn't really
      : mockValueTypeField(props.parentField),
  valueTypeFields: props.valueTypeFields.map(mockValueTypeField),
})

export type MockFilePropertiesInput = Pick<
  FileProperties,
  'type' | 'fullName'
> &
  Partial<FileProperties>
export const mockFileProperties = (
  props: MockFilePropertiesInput,
): FileProperties => ({
  createdById: '0054J000002KGspQAG',
  createdByName: 'test',
  createdDate: '2020-05-01T14:31:36.000Z',
  fileName: `${_.camelCase(props.type)}/${props.fullName}.${_.snakeCase(props.type)}`,
  id: _.uniqueId(),
  lastModifiedById: '0054J000002KGspQAG',
  lastModifiedByName: 'test',
  lastModifiedDate: '2020-05-01T14:41:36.000Z',
  manageableState: 'unmanaged',
  ...props,
})

export type MockRetrieveResultInput = Partial<
  Omit<RetrieveResult, 'zipFile'>
> & {
  zipFiles?: ZipFile[]
}
export const mockRetrieveResult = async (
  props: MockRetrieveResultInput,
): Promise<RetrieveResult> => ({
  fileProperties: [],
  id: _.uniqueId(),
  messages: [],
  zipFile: await createEncodedZipContent(props.zipFiles ?? []),
  ...props,
})
export const mockRetrieveLocator = (
  props: MockRetrieveResultInput | Promise<RetrieveResult>,
): RetrieveResultLocator<RetrieveResult> =>
  ({
    complete: () =>
      props instanceof Promise ? props : mockRetrieveResult(props),
  }) as RetrieveResultLocator<RetrieveResult>

export const mockDeployMessage = (
  params: Partial<DeployMessage>,
): DeployMessage => ({
  changed: false,
  columnNumber: 0,
  componentType: '',
  created: false,
  createdDate: '',
  deleted: false,
  fileName: '',
  fullName: '',
  id: '',
  lineNumber: 0,
  problem: '',
  problemType: '',
  success: false,
  ...params,
})

export const mockRunTestFailure = (
  params: Partial<RunTestFailure>,
): RunTestFailure => ({
  id: _.uniqueId(),
  message: 'message',
  methodName: 'methodName',
  name: 'name',
  stackTrace: 'stackTrace',
  time: 1,
  ...params,
})

type PartialRunTestResult = Omit<Partial<RunTestsResult>, 'failures'> & {
  failures?: Partial<RunTestFailure>[]
}

export const mockRunTestResult = (
  params?: PartialRunTestResult,
): RunTestsResult | undefined =>
  params === undefined
    ? undefined
    : {
        numFailures: collections.array.makeArray(params.failures).length,
        numTestsRun: collections.array.makeArray(params.failures).length,
        totalTime: 10,
        ...params,
        failures: collections.array
          .makeArray(params.failures)
          .map(mockRunTestFailure),
      }

type GetDeployResultParams = {
  id?: string
  success?: boolean
  componentSuccess?: Partial<DeployMessage>[]
  componentFailure?: Partial<DeployMessage>[]
  runTestResult?: PartialRunTestResult
  rollbackOnError?: boolean
  ignoreWarnings?: boolean
  checkOnly?: boolean
  testCompleted?: number
  testErrors?: number
  errorMessage?: string
  retrieveResult?: RetrieveResult
}

type MockDeployResultParams = GetDeployResultParams &
  Required<Pick<GetDeployResultParams, 'id'>>

export const mockDeployResultComplete = ({
  id,
  success = true,
  errorMessage,
  componentSuccess = [],
  componentFailure = [],
  runTestResult = undefined,
  ignoreWarnings = true,
  rollbackOnError = true,
  checkOnly = false,
  testCompleted = 0,
  testErrors = 0,
  retrieveResult,
}: MockDeployResultParams): DeployResult => ({
  id,
  checkOnly,
  completedDate: '2020-05-01T14:31:36.000Z',
  createdDate: '2020-05-01T14:21:36.000Z',
  done: true,
  details: [
    {
      componentFailures: componentFailure.map(mockDeployMessage),
      componentSuccesses: componentSuccess.map(mockDeployMessage),
      runTestResult: mockRunTestResult(runTestResult),
      retrieveResult,
    },
  ],
  ignoreWarnings,
  lastModifiedDate: '2020-05-01T14:31:36.000Z',
  numberComponentErrors: componentFailure.length,
  numberComponentsDeployed: componentSuccess.length,
  numberComponentsTotal: componentFailure.length + componentSuccess.length,
  numberTestErrors: testErrors,
  numberTestsCompleted: testCompleted,
  numberTestsTotal: testCompleted + testErrors,
  rollbackOnError,
  startDate: '2020-05-01T14:21:36.000Z',
  status: success ? 'Succeeded' : 'Failed',
  success,
  errorMessage,
})

export const mockDeployResultInProgress = ({
  id,
  runTestResult = undefined,
  ignoreWarnings = true,
  rollbackOnError = true,
  checkOnly = false,
  testCompleted = 0,
  testErrors = 0,
}: MockDeployResultParams): DeployResult => ({
  id,
  checkOnly,
  completedDate: '2020-05-01T14:31:36.000Z',
  createdDate: '2020-05-01T14:21:36.000Z',
  done: false,
  details: [
    {
      componentFailures: [],
      componentSuccesses: [],
      runTestResult: mockRunTestResult(runTestResult),
    },
  ],
  ignoreWarnings,
  lastModifiedDate: '2020-05-01T14:31:36.000Z',
  numberComponentErrors: 0,
  numberComponentsDeployed: 0,
  numberComponentsTotal: 0,
  numberTestErrors: testErrors,
  numberTestsCompleted: testCompleted,
  numberTestsTotal: testCompleted + testErrors,
  rollbackOnError,
  startDate: '2020-05-01T14:21:36.000Z',
  status: 'Pending',
  success: false,
  errorMessage: undefined,
})

export const mockDeployResult = (
  params: GetDeployResultParams,
): DeployResultLocator<DeployResult> => {
  const mockParams: MockDeployResultParams = _.defaults(params, {
    id: _.uniqueId(),
  })
  return {
    complete: jest.fn().mockResolvedValue(mockDeployResultComplete(mockParams)),
    check: jest
      .fn()
      .mockResolvedValue(mockDeployResultComplete(mockParams))
      .mockResolvedValueOnce(mockDeployResultInProgress(mockParams)),
  } as unknown as DeployResultLocator<DeployResult>
}

export const mockQueryResult = (
  props: Partial<QueryResult<Value>>,
): QueryResult<Value> => ({
  done: true,
  totalSize: 0,
  records: [],
  ...props,
})

const mockIdentity = (organizationId: string): IdentityInfo => ({
  id: '',
  // eslint-disable-next-line camelcase
  asserted_user: false,
  // eslint-disable-next-line camelcase
  user_id: '',
  // eslint-disable-next-line camelcase
  organization_id: organizationId,
  username: '',
  // eslint-disable-next-line camelcase
  nick_name: '',
  // eslint-disable-next-line camelcase
  display_name: '',
  email: '',
  // eslint-disable-next-line camelcase
  email_verified: false,
  // eslint-disable-next-line camelcase
  first_name: '',
  // eslint-disable-next-line camelcase
  last_name: '',
  timezone: '',
  photos: {
    picture: '',
    thumbnail: '',
  },
  // eslint-disable-next-line camelcase
  addr_street: '',
  // eslint-disable-next-line camelcase
  addr_city: '',
  // eslint-disable-next-line camelcase
  addr_state: '',
  // eslint-disable-next-line camelcase
  addr_country: '',
  // eslint-disable-next-line camelcase
  addr_zip: '',
  // eslint-disable-next-line camelcase
  mobile_phone: '',
  // eslint-disable-next-line camelcase
  mobile_phone_verified: false,
  // eslint-disable-next-line camelcase
  is_lightning_login_user: false,
  status: {
    // eslint-disable-next-line camelcase
    created_date: null,
    body: '',
  },
  urls: {
    enterprise: '',
    metadata: '',
    partner: '',
    rest: '',
    sobjects: '',
    search: '',
    query: '',
    recent: '',
    // eslint-disable-next-line camelcase
    tooling_soap: '',
    // eslint-disable-next-line camelcase
    tooling_rest: '',
    profile: '',
    feeds: '',
    groups: '',
    users: '',
    // eslint-disable-next-line camelcase
    feed_items: '',
    // eslint-disable-next-line camelcase
    feed_elements: '',
    // eslint-disable-next-line camelcase
    custom_domain: '',
  },
  active: false,
  // eslint-disable-next-line camelcase
  user_type: '',
  language: '',
  locale: '',
  utcOffset: 0,
  // eslint-disable-next-line camelcase
  last_modified_date: new Date(),
  // eslint-disable-next-line camelcase
  is_app_installed: false,
})

export const mockSObjectField = (
  overrides: Partial<SalesforceField>,
): SalesforceField => ({
  aggregatable: false,
  autoNumber: false,
  byteLength: 0,
  calculated: false,
  cascadeDelete: false,
  caseSensitive: false,
  createable: false,
  custom: false,
  defaultedOnCreate: false,
  dependentPicklist: false,
  deprecatedAndHidden: false,
  externalId: false,
  filterable: false,
  groupable: false,
  htmlFormatted: false,
  idLookup: false,
  label: 'label',
  length: 0,
  name: 'name',
  nameField: false,
  namePointing: false,
  nillable: false,
  permissionable: false,
  polymorphicForeignKey: false,
  queryByDistance: false,
  restrictedPicklist: false,
  scale: 0,
  searchPrefilterable: false,
  soapType: 'xsd:string',
  sortable: false,
  type: 'string',
  unique: false,
  updateable: false,
  ...overrides,
})

export const mockSObjectDescribeGlobal = (
  overrides: Partial<DescribeGlobalSObjectResult>,
): DescribeGlobalSObjectResult => ({
  activateable: false,
  createable: false,
  custom: true,
  customSetting: false,
  deletable: false,
  deprecatedAndHidden: false,
  feedEnabled: false,
  hasSubtypes: false,
  isSubtype: false,
  keyPrefix: '0AE',
  label: 'obj',
  labelPlural: 'objs',
  layoutable: false,
  mergeable: false,
  mruEnabled: false,
  name: 'obj__c',
  queryable: false,
  replicateable: false,
  retrieveable: false,
  searchable: false,
  triggerable: false,
  undeletable: false,
  updateable: false,
  urls: {},
  ...overrides,
})

export const mockSObjectDescribe = (
  overrides: Omit<Partial<DescribeSObjectResult>, 'fields'> & {
    fields?: Partial<SalesforceField>[]
  },
): DescribeSObjectResult => ({
  activateable: false,
  childRelationships: [],
  compactLayoutable: false,
  createable: false,
  custom: false,
  customSetting: false,
  deletable: false,
  deprecatedAndHidden: false,
  feedEnabled: false,
  label: 'obj',
  labelPlural: 'objs',
  layoutable: false,
  mergeable: false,
  mruEnabled: false,
  name: 'obj__c',
  namedLayoutInfos: [],
  queryable: false,
  recordTypeInfos: [],
  replicateable: false,
  retrieveable: false,
  searchable: false,
  searchLayoutable: false,
  supportedScopes: [],
  triggerable: false,
  undeletable: false,
  updateable: false,
  urls: {},
  ...overrides,
  fields: overrides.fields?.map(mockSObjectField) ?? [],
})

export const mockJsforce: () => MockInterface<Connection> = () => ({
  login: mockFunction<Connection['login']>().mockImplementation(async () => ({
    id: '',
    organizationId: '',
    url: '',
  })),
  metadata: {
    pollInterval: 1000,
    pollTimeout: 10000,
    checkDeployStatus: mockFunction<
      Metadata['checkDeployStatus']
    >().mockResolvedValue(mockDeployResultInProgress({ id: _.uniqueId() })),
    describe: mockFunction<Metadata['describe']>().mockResolvedValue({
      metadataObjects: [],
      organizationNamespace: '',
    }),
    describeValueType: mockFunction<
      Metadata['describeValueType']
    >().mockResolvedValue(mockDescribeValueResult({ valueTypeFields: [] })),
    read: mockFunction<Metadata['read']>().mockResolvedValue([]),
    list: mockFunction<Metadata['list']>().mockResolvedValue([]),
    upsert: mockFunction<Metadata['upsert']>().mockResolvedValue([]),
    delete: mockFunction<Metadata['delete']>().mockResolvedValue([]),
    update: mockFunction<Metadata['update']>().mockResolvedValue([]),
    retrieve: mockFunction<Metadata['retrieve']>().mockReturnValue(
      mockRetrieveLocator({}),
    ),
    deploy: mockFunction<Metadata['deploy']>().mockReturnValue(
      mockDeployResult({}),
    ),
    deployRecentValidation: mockFunction<
      Metadata['deployRecentValidation']
    >().mockReturnValue(mockDeployResult({})),
  },
  soap: {
    describeSObjects: mockFunction<
      Soap['describeSObjects']
    >().mockResolvedValue([]),
  },

  describeGlobal: mockFunction<
    Connection['describeGlobal']
  >().mockResolvedValue({ sobjects: [] }),
  query: mockFunction<Connection['query']>().mockResolvedValue(
    mockQueryResult({}),
  ),
  queryMore: mockFunction<Connection['queryMore']>().mockResolvedValue(
    mockQueryResult({}),
  ),
  bulk: {
    pollInterval: 1000,
    pollTimeout: 10000,
    load: mockFunction<Bulk['load']>().mockResolvedValue([]),
  },
  limits: mockFunction<Connection['limits']>().mockResolvedValue({
    DailyApiRequests: { Remaining: 10000 },
  }),
  tooling: {
    query: mockFunction<Tooling['query']>().mockResolvedValue(
      mockQueryResult({}),
    ),
    queryMore: mockFunction<Tooling['queryMore']>().mockResolvedValue(
      mockQueryResult({}),
    ),
  },
  identity: mockFunction<Connection['identity']>().mockImplementation(
    async () => mockIdentity(''),
  ),
  instanceUrl: MOCK_INSTANCE_URL,
})
