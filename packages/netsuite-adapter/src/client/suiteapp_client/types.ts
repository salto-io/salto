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
  items: Record<string, unknown>[]
}

export const SAVED_SEARCH_RESULTS_SCHEMA = {
  anyOf: [{
    type: 'object',
    properties: {
      status: { const: 'success' },
      results: {
        type: 'array',
        items: { type: 'object' },
      },
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

export type SavedSearchSuccessResults = {
  status: 'success'
  results: Record<string, unknown>[]
}

export type SavedSearchErrorResults = {
  status: 'error'
  message: string
  error?: Record<string, unknown>
}

export const isError = (results: SavedSearchResults): results is SavedSearchErrorResults =>
  results.status === 'error'

export type SavedSearchResults = SavedSearchSuccessResults | SavedSearchErrorResults


export type HttpMethod = 'POST' | 'GET'


export type SuiteAppClientParameters = {
  credentials: Credentials
  callsLimiter: Bottleneck
}

export type SavedSearchQuery = {
  type: string
  columns: string[]
  filters: string[][]
}
