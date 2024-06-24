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
import { ElemID, Values } from '@salto-io/adapter-api'
import Bottleneck from 'bottleneck'
import { InstanceLimiterFunc, SuiteAppClientConfig } from '../../config/types'
import { SuiteAppConfigRecordType, SUITEAPP_CONFIG_RECORD_TYPES } from '../../types'
import { SuiteAppCredentials } from '../credentials'

export const SUITE_QL_RESULTS_SCHEMA = {
  type: 'object',
  properties: {
    hasMore: { type: 'boolean' },
    totalResults: { type: 'number' },
    items: {
      type: 'array',
      items: { type: 'object' },
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rel: { type: 'string' },
          href: { type: 'string' },
        },
        required: ['rel', 'href'],
      },
    },
  },
  required: ['hasMore', 'items'],
  additionalProperties: true,
}

export type SuiteQLQueryArgs = {
  select: string
  from: string
  join?: string
  where?: string
  groupBy?: string
  orderBy?: string
}

export type SuiteQLResults = {
  hasMore: boolean
  items: Values[]
  totalResults?: number
  links?: {
    rel: string
    href: string
  }[]
}

export const SAVED_SEARCH_RESULTS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
  },
}

export type SavedSearchResults = Values[]

export const RESTLET_RESULTS_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      properties: {
        status: { const: 'success' },
        results: {},
      },
      required: ['status', 'results'],
    },
    {
      type: 'object',
      properties: {
        status: { const: 'error' },
        message: { type: 'string' },
        error: { type: 'object' },
      },
      required: ['status', 'message'],
    },
  ],
  additionalProperties: true,
}

export type RestletSuccessResults = {
  status: 'success'
  results: unknown
}

export type RestletErrorResults = {
  status: 'error'
  message: string
  error?: Values
}

export type RestletResults = RestletSuccessResults | RestletErrorResults

export const isError = (results: RestletResults): results is RestletErrorResults => results.status === 'error'

export type HttpMethod = 'POST' | 'GET'

export type SuiteAppClientParameters = {
  credentials: SuiteAppCredentials
  config?: SuiteAppClientConfig
  globalLimiter: Bottleneck
  instanceLimiter: InstanceLimiterFunc
}

export type SavedSearchQuery = {
  type: string
  columns: string[]
  filters: Array<string[] | string>
}

export enum EnvType {
  PRODUCTION = 'PRODUCTION',
  SANDBOX = 'SANDBOX',
  BETA = 'BETA',
  INTERNAL = 'INTERNAL',
}

const BASIC_SYSTEM_INFO_SCHEME_PROPERTIES = {
  time: { type: 'number' },
  appVersion: {
    type: 'array',
    items: { type: 'number' },
  },
}

export const SYSTEM_INFORMATION_SCHEME = {
  anyOf: [
    {
      type: 'object',
      properties: {
        ...BASIC_SYSTEM_INFO_SCHEME_PROPERTIES,
        envType: {
          type: 'string',
          enum: [EnvType.PRODUCTION, EnvType.SANDBOX, EnvType.BETA, EnvType.INTERNAL],
        },
      },
      required: ['time', 'appVersion', 'envType'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        ...BASIC_SYSTEM_INFO_SCHEME_PROPERTIES,
      },
      required: ['time', 'appVersion'],
      additionalProperties: false,
    },
  ],
}

export type SystemInformation = {
  time: Date
  appVersion: number[]
  // TODO: make this field not optional once SALTO-2602 is merged and users are upgraded to SuiteApp version 0.1.7
  envType?: EnvType
}

export const FILES_READ_SCHEMA = {
  items: {
    anyOf: [
      {
        properties: {
          content: {
            type: 'string',
          },
          status: {
            enum: ['success'],
            type: 'string',
          },
          type: {
            type: 'string',
          },
        },
        required: ['content', 'status', 'type'],
        type: 'object',
      },
      {
        properties: {
          error: {
            type: 'object',
          },
          status: {
            enum: ['error'],
            type: 'string',
          },
        },
        required: ['error', 'status'],
        type: 'object',
      },
    ],
  },
  type: 'array',
}

type ReadSuccess = {
  status: 'success'
  type: string
  content: string
}

type ReadFailure = {
  status: 'error'
  error: Error
}

export type ReadResults = (ReadSuccess | ReadFailure)[]

export type RestletOperation = 'search' | 'sysInfo' | 'readFile' | 'config' | 'record' | 'listBundles' | 'listSuiteApps'

export type CallsLimiter = <T>(fn: () => Promise<T>) => Promise<T>

export type FileDetails = {
  type: 'file'
  path: string
  id?: number
  folder: string | undefined
  bundleable: boolean
  isInactive: boolean
  isOnline: boolean
  hideInBundle: boolean
  description: string
} & (
  | {
      content: Buffer
    }
  | {
      url: string
    }
)

export type FolderDetails = {
  type: 'folder'
  path: string
  id?: number
  parent: string | undefined
  bundleable: boolean
  isInactive: boolean
  isPrivate: boolean
  description: string
}

export type FileCabinetInstanceDetails = FileDetails | FolderDetails

export type ExistingFileCabinetInstanceDetails = FileCabinetInstanceDetails & { id: number }

export const CONFIG_FIELD_DEFINITION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string' },
    selectOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text', 'value'],
      },
    },
  },
  required: ['id', 'label', 'type', 'selectOptions'],
}

export type SelectOption = {
  value: unknown
  text: string
}

export type ConfigFieldDefinition = {
  id: string
  label: string
  type: string
  selectOptions: SelectOption[]
}

export const CONFIG_RECORD_DATA_SCHEMA = {
  type: 'object',
  properties: {
    fields: { type: 'object' },
  },
  required: ['fields'],
}

export type ConfigRecordData = {
  fields: Record<string, unknown>
}

export type ConfigRecord = {
  configType: SuiteAppConfigRecordType
  fieldsDef: ConfigFieldDefinition[]
  data: ConfigRecordData
}

export const GET_CONFIG_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          configType: { enum: SUITEAPP_CONFIG_RECORD_TYPES },
          fieldsDef: {
            type: 'array',
            items: { type: 'object' },
          },
          data: { type: 'object' },
        },
        required: ['configType', 'fieldsDef', 'data'],
      },
    },
    errors: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  required: ['results', 'errors'],
}

export type GetConfigResult = {
  results: ConfigRecord[]
  errors: Values[]
}

type SetConfigField = {
  fieldId: string
  value: string
}

export type SetConfigType = {
  configType: string
  items: SetConfigField[]
}

export type SuccessSetConfig = {
  configType: string
  status: 'success'
}

export type FailSetConfig = {
  configType: string
  status: 'fail'
  errorMessage: string
}

export type SetConfigResult = (SuccessSetConfig | FailSetConfig)[]

export type HasElemIDFunc = (elemID: ElemID) => Promise<boolean>

export const isSuccessSetConfig = (result: SuccessSetConfig | FailSetConfig): result is SuccessSetConfig =>
  result.status === 'success'

export const SET_CONFIG_RESULT_SCHEMA = {
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'object',
        properties: {
          configType: { enum: SUITEAPP_CONFIG_RECORD_TYPES },
          status: { const: 'success' },
        },
        required: ['configType', 'status'],
      },
      {
        type: 'object',
        properties: {
          configType: { enum: SUITEAPP_CONFIG_RECORD_TYPES },
          status: { const: 'fail' },
          errorMessage: { type: 'string' },
        },
        required: ['configType', 'status', 'errorMessage'],
      },
    ],
  },
}

export type SuiteAppType = {
  appId: string
  name: string
  version: string
  description: string
  dateInstalled: Date
  dateLastUpdated: Date
  publisherId: string
  installedBy: {
    id: number
    name: string
  }
}

export const GET_BUNDLES_RESULT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      version: { type: ['string', 'null'] },
      isManaged: { type: ['boolean', 'null'] },
      description: { type: ['string', 'null'] },
      dateInstalled: { type: ['string', 'null'] },
      dateLastUpdated: { type: ['string', 'null'] },
      installedFrom: { type: ['string', 'null'] },
      publisher: {
        type: ['object', 'null'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      },
      installedBy: {
        type: ['object', 'null'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      },
    },
    required: ['id', 'name', 'installedFrom', 'publisher'],
  },
}

export const GET_SUITEAPPS_RESULT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      appId: { type: 'string' },
      name: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['appId', 'name', 'version'],
  },
}

export type SetConfigRecordsValuesResult = { errorMessage: string } | SetConfigResult

export const QUERY_RECORD_TYPES = {
  workflow: 'workflow',
  workflowstate: 'workflowstate',
  workflowtransition: 'workflowtransition',
  actiontype: 'actiontype',
  workflowstatecustomfield: 'workflowstatecustomfield',
  workflowcustomfield: 'workflowcustomfield',
} as const

export type QueryRecordType = keyof typeof QUERY_RECORD_TYPES

export type QueryRecordSchema = {
  type: QueryRecordType
  sublistId?: string
  idAlias?: string
  typeSuffix?: string
  customTypes?: Record<string, string>
  fields: string[]
  filter: {
    fieldId: string
    in: string[]
  }
  sublists?: QueryRecordSchema[]
}

export type QueryRecordResponse = {
  body: Record<string, unknown>
  sublists: QueryRecordResponse[]
  errors?: string[]
}

export const QUERY_RECORDS_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['body', 'sublists'],
    properties: {
      body: { type: 'object' },
      sublists: { type: 'array' },
      errors: { type: 'array', items: { type: 'string' } },
    },
  },
}
