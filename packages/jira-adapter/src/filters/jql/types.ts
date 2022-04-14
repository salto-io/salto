/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'

export type ParsedJql = {
  query: string
  structure: Record<string, unknown>
}

export type JqlParseResponse = {
  queries: ParsedJql[]
}

const JQL_PARSE_RESPONSE_SCHEME = Joi.object({
  queries: Joi.array().items(
    Joi.object({
      query: Joi.string().required(),
      structure: Joi.object().required(),
    }).unknown(true).required(),
  ).required(),
})

export const isJqlParseResponse = createSchemeGuard<JqlParseResponse>(JQL_PARSE_RESPONSE_SCHEME, 'Received an invalid jql parse response')

export type JqlFieldDetails = {
  field: {
    name: string
  }
  operand?: {
    values?: {
      value?: string
    }[]

    value?: string
  }
}

const JQL_FIELD_DETAILS_SCHEME = Joi.object({
  field: Joi.object({
    name: Joi.string().required(),
  }).unknown(true).required(),

  operand: Joi.object({
    values: Joi.array().items(
      Joi.object({
        value: Joi.string().optional(),
      }).unknown(true),
    ).optional(),

    value: Joi.string().optional(),
  }).unknown(true).optional(),
}).unknown(true).required()

export const isJqlFieldDetails = createSchemeGuard<JqlFieldDetails>(JQL_FIELD_DETAILS_SCHEME)
