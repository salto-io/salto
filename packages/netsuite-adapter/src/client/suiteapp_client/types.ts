/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Credentials } from '../credentials'


export const SUITE_QL_RESULTS_SCHEMA = {
  type: 'object',
  properties: {
    hasMore: { type: 'boolean' },
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

export const isError = (results: RestletResults): results is RestletErrorResults =>
  results.status === 'error'

export type RestletResults = RestletSuccessResults | RestletErrorResults


export type HttpMethod = 'POST' | 'GET'


export type SuiteAppClientParameters = {
  credentials: Credentials
  callsLimiter: Bottleneck
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

export type RestletOperation = 'search' | 'sysInfo'
