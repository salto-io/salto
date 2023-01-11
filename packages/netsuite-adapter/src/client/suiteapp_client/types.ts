/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Values } from '@salto-io/adapter-api'
import Bottleneck from 'bottleneck'
import { SuiteAppClientConfig } from '../../config'
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
  },
  required: ['hasMore', 'items'],
  additionalProperties: true,
}

export type SuiteQLResults = {
  hasMore: boolean
  items: Values[]
  totalResults?: number
}

export const SAVED_SEARCH_RESULTS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
  },
}

export type SavedSearchResults = Values[]

export const RESTLET_RESULTS_SCHEMA = {
  anyOf: [{
    type: 'object',
    properties: {
      status: { const: 'success' },
      results: {},
    },
    required: ['status', 'results'],
  }, {
    type: 'object',
    properties: {
      status: { const: 'error' },
      message: { type: 'string' },
      error: { type: 'object' },
    },
    required: ['status', 'message'],
  }],
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

export const isError = (results: RestletResults): results is RestletErrorResults =>
  results.status === 'error'

export type HttpMethod = 'POST' | 'GET'


export type SuiteAppClientParameters = {
  credentials: SuiteAppCredentials
  config?: SuiteAppClientConfig
  globalLimiter: Bottleneck
}

export type SavedSearchQuery = {
  type: string
  columns: string[]
  filters: Array<string[] | string>
}

export const SYSTEM_INFORMATION_SCHEME = {
  type: 'object',
  properties: {
    time: { type: 'number' },
    appVersion: {
      type: 'array',
      items: { type: 'number' },
    },
  },
  required: ['time', 'appVersion'],
  additionalProperties: true,
}


export type SystemInformation = {
  time: Date
  appVersion: number[]
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
            enum: [
              'success',
            ],
            type: 'string',
          },
          type: {
            type: 'string',
          },
        },
        required: [
          'content',
          'status',
          'type',
        ],
        type: 'object',
      },
      {
        properties: {
          error: {
            type: 'object',
          },
          status: {
            enum: [
              'error',
            ],
            type: 'string',
          },
        },
        required: [
          'error',
          'status',
        ],
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

export type RestletOperation = 'search' | 'sysInfo' | 'readFile' | 'config'

export type CallsLimiter = <T>(fn: () => Promise<T>) => Promise<T>

export type FileDetails = {
  type: 'file'
  path: string
  id?: number
  folder: number | undefined
  bundleable: boolean
  isInactive: boolean
  isOnline: boolean
  hideInBundle: boolean
  description: string
} & ({
  content: Buffer
} | {
  url: string
})

export type FolderDetails = {
  type: 'folder'
  path: string
  id?: number
  parent: number | undefined
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

export const isSuccessSetConfig = (
  result: SuccessSetConfig | FailSetConfig
): result is SuccessSetConfig =>
  result.status === 'success'

export const SET_CONFIG_RESULT_SCHEMA = {
  type: 'array',
  items: {
    anyOf: [{
      type: 'object',
      properties: {
        configType: { enum: SUITEAPP_CONFIG_RECORD_TYPES },
        status: { const: 'success' },
      },
      required: ['configType', 'status'],
    }, {
      type: 'object',
      properties: {
        configType: { enum: SUITEAPP_CONFIG_RECORD_TYPES },
        status: { const: 'fail' },
        errorMessage: { type: 'string' },
      },
      required: ['configType', 'status', 'errorMessage'],
    }],
  },
}

export type SetConfigRecordsValuesResult = { errorMessage: string } | SetConfigResult
