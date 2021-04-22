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
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import { QueryResult, SavedSearchResult } from './types'

const log = logger(module)

export const QUERY_RESULTS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  items: {
    properties: {
      id: {
        type: 'string',
      },
      scriptid: {
        type: 'string',
      },
    },
    required: [
      'id',
      'scriptid',
    ],
    type: 'object',
  },
  type: 'array',
}

export const areQueryResultsValid = (results: unknown): results is QueryResult[] => {
  if (results === undefined) {
    log.error('SuiteQL query failed')
    return false
  }

  const ajv = new Ajv({ allErrors: true })
  if (!ajv.validate<QueryResult[]>(QUERY_RESULTS_SCHEMA, results)) {
    log.error(`Got invalid results from SuiteQL query: ${ajv.errorsText()}`)
    return false
  }
  return true
}

export const SAVED_SEARCH_RESULTS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  items: {
    properties: {
      id: {
        type: 'string',
      },
      internalid: {
        items: [
          {
            properties: {
              value: {
                type: 'string',
              },
            },
            required: [
              'value',
            ],
            type: 'object',
          },
        ],
        maxItems: 1,
        minItems: 1,
        type: 'array',
      },
    },
    required: [
      'id',
      'internalid',
    ],
    type: 'object',
  },
  type: 'array',
}

export const areSavedSearchResultsValid = (results: unknown): results is SavedSearchResult[] => {
  if (results === undefined) {
    log.error('SavedSearch query failed')
    return false
  }

  const ajv = new Ajv({ allErrors: true })
  if (!ajv.validate<SavedSearchResult[]>(SAVED_SEARCH_RESULTS_SCHEMA, results)) {
    log.error(`Got invalid results from SavedSearch query: ${ajv.errorsText()}`)
    return false
  }
  return true
}
