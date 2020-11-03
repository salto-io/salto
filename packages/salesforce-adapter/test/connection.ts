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
import _ from 'lodash'
import { Value } from '@salto-io/adapter-api'
import { IdentityInfo } from 'jsforce'
import { MetadataObject, DescribeMetadataResult, ValueTypeField, DescribeValueTypeResult, FileProperties, RetrieveResult, RetrieveResultLocator, DeployResultLocator, DeployResult, QueryResult } from 'jsforce-types'
import Connection, { Metadata, Soap, Bulk, Tooling } from '../src/client/jsforce'
import { createEncodedZipContent, MockInterface, mockFunction, ZipFile } from './utils'

export type MockDescribeResultInput = Pick<MetadataObject, 'xmlName'> & Partial<MetadataObject>
export const mockDescribeResult = (
  ...objects: MockDescribeResultInput[]
): DescribeMetadataResult => ({
  metadataObjects: objects.map(props => ({
    childXmlNames: [],
    directoryName: _.lowerCase(props.xmlName),
    inFolder: false,
    metaFile: false,
    suffix: '.file',
    ...props,
  })),
  organizationNamespace: '',
  testRequired: false,
  partialSaveAllowed: true,
})

export type MockValueTypeFieldInput =
  Pick<ValueTypeField, 'name' | 'soapType'>
  & Partial<Omit<ValueTypeField, 'fields'> & { fields: MockValueTypeFieldInput[] }>

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
  fields: props.fields === undefined ? [] : props.fields.map(mockValueTypeField),
})

export type MockDescribeValueResultInput =
  Partial<Omit<DescribeValueTypeResult, 'valueTypeFields' | 'parentField'>> & {
    parentField?: MockValueTypeFieldInput
    valueTypeFields: MockValueTypeFieldInput[]
  }

export const mockDescribeValueResult = (
  props: MockDescribeValueResultInput
): DescribeValueTypeResult => ({
  apiCreatable: true,
  apiDeletable: true,
  apiReadable: true,
  apiUpdatable: true,
  ...props,
  parentField: props.parentField === undefined
    ? undefined as unknown as ValueTypeField // The type says this is required but it isn't really
    : mockValueTypeField(props.parentField),
  valueTypeFields: props.valueTypeFields.map(mockValueTypeField),
})

export type MockFilePropertiesInput = Pick<FileProperties, 'type' | 'fullName'> & Partial<FileProperties>
export const mockFileProperties = (
  props: MockFilePropertiesInput
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

export type MockRetrieveResultInput = Partial<Omit<RetrieveResult, 'zipFile'>> &{
  zipFiles?: ZipFile[]
}
export const mockRetrieveResult = (
  props: MockRetrieveResultInput
): RetrieveResultLocator<RetrieveResult> => ({
  complete: async () => ({
    fileProperties: [],
    id: _.uniqueId(),
    messages: [],
    zipFile: await createEncodedZipContent(props.zipFiles ?? []),
    ...props,
  }),
} as RetrieveResultLocator<RetrieveResult>)

export const mockDeployResult = (
  props: Partial<DeployResult>
): DeployResultLocator<DeployResult> => ({
  complete: () => Promise.resolve({
    id: _.uniqueId(),
    checkOnly: false,
    completedDate: '2020-05-01T14:31:36.000Z',
    createdDate: '2020-05-01T14:21:36.000Z',
    done: true,
    lastModifiedDate: '2020-05-01T14:31:36.000Z',
    numberComponentErrors: 0,
    numberComponentsDeployed: 0,
    numberComponentsTotal: 0,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    startDate: '2020-05-01T14:21:36.000Z',
    status: 'Succeeded',
    success: true,
    ...props,
  }),
} as DeployResultLocator<DeployResult>)

const mockQueryResult = (
  props: Partial<QueryResult<Value>>,
): QueryResult<Value> => ({
  done: true,
  totalSize: 0,
  records: [],
  ...props,
})

const mockIdentity = (organizationId: string): IdentityInfo => ({
  id: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  asserted_user: false,
  // eslint-disable-next-line @typescript-eslint/camelcase
  user_id: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  organization_id: organizationId,
  username: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  nick_name: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  display_name: '',
  email: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  email_verified: false,
  // eslint-disable-next-line @typescript-eslint/camelcase
  first_name: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  last_name: '',
  timezone: '',
  photos: {
    picture: '',
    thumbnail: '',
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  addr_street: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  addr_city: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  addr_state: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  addr_country: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  addr_zip: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  mobile_phone: '',
  // eslint-disable-next-line @typescript-eslint/camelcase
  mobile_phone_verified: false,
  // eslint-disable-next-line @typescript-eslint/camelcase
  is_lightning_login_user: false,
  status: {
    // eslint-disable-next-line @typescript-eslint/camelcase
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
    // eslint-disable-next-line @typescript-eslint/camelcase
    tooling_soap: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    tooling_rest: '',
    profile: '',
    feeds: '',
    groups: '',
    users: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    feed_items: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    feed_elements: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    custom_domain: '',
  },
  active: false,
  // eslint-disable-next-line @typescript-eslint/camelcase
  user_type: '',
  language: '',
  locale: '',
  utcOffset: 0,
  // eslint-disable-next-line @typescript-eslint/camelcase
  last_modified_date: new Date(),
  // eslint-disable-next-line @typescript-eslint/camelcase
  is_app_installed: false,
})

export const mockJsforce: () => MockInterface<Connection> = () => ({
  login: mockFunction<Connection['login']>().mockImplementation(async () => (
    { id: '', organizationId: '', url: '' }
  )),
  metadata: {
    pollInterval: 1000,
    pollTimeout: 10000,
    describe: mockFunction<Metadata['describe']>().mockResolvedValue({ metadataObjects: [] }),
    describeValueType: mockFunction<Metadata['describeValueType']>().mockResolvedValue(
      mockDescribeValueResult({ valueTypeFields: [] })
    ),
    read: mockFunction<Metadata['read']>().mockResolvedValue([]),
    list: mockFunction<Metadata['list']>().mockResolvedValue([]),
    upsert: mockFunction<Metadata['upsert']>().mockResolvedValue([]),
    delete: mockFunction<Metadata['delete']>().mockResolvedValue([]),
    update: mockFunction<Metadata['update']>().mockResolvedValue([]),
    retrieve: mockFunction<Metadata['retrieve']>().mockReturnValue(mockRetrieveResult({})),
    deploy: mockFunction<Metadata['deploy']>().mockReturnValue(mockDeployResult({})),
  },
  soap: {
    describeSObjects: mockFunction<Soap['describeSObjects']>().mockResolvedValue([]),
  },

  describeGlobal: mockFunction<Connection['describeGlobal']>().mockResolvedValue({ sobjects: [] }),
  query: mockFunction<Connection['query']>().mockResolvedValue(mockQueryResult({})),
  queryMore: mockFunction<Connection['queryMore']>().mockResolvedValue(mockQueryResult({})),
  bulk: {
    pollInterval: 1000,
    pollTimeout: 10000,
    load: mockFunction<Bulk['load']>().mockResolvedValue([]),
  },
  limits: mockFunction<Connection['limits']>().mockResolvedValue({
    DailyApiRequests: { Remaining: 10000 },
  }),
  tooling: {
    query: mockFunction<Tooling['query']>().mockResolvedValue(mockQueryResult({})),
    queryMore: mockFunction<Tooling['queryMore']>().mockResolvedValue(mockQueryResult({})),
  },
  identity: mockFunction<Connection['identity']>().mockImplementation(async () => mockIdentity('')),
})
