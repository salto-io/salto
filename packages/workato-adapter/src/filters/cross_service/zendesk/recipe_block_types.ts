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
import Joi from 'joi'
import { Value } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { BlockBase } from '../recipe_block_types'

export type ZendeskBlock = BlockBase & {
  as: string
  provider: 'zendesk' | 'zendesk_secondary'
  name: string
  input: {
    [key: string]: Value
  }
}

const ZENDESK_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().valid('zendesk', 'zendesk_secondary').required(),
  name: Joi.string().required(),
  input: Joi.object().required(),
})
  .unknown(true)
  .required()

export const isZendeskBlock = createSchemeGuard<ZendeskBlock>(ZENDESK_BLOCK_SCHEMA)
