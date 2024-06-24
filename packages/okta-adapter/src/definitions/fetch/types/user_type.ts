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
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { definitions } from '@salto-io/adapter-components'
import { LINKS_FIELD } from '../../../constants'
import { extractIdFromUrl } from '../../../utils'

const log = logger(module)

export type UserType = {
  _links: {
    schema: {
      href: string
    }
  }
}

const USER_TYPE_SCHEMA = Joi.object({
  _links: Joi.object({
    schema: Joi.object({
      href: Joi.string().required(),
    })
      .required()
      .unknown(true),
  })
    .required()
    .unknown(true),
}).unknown(true)

export const isUserType = createSchemeGuard<UserType>(USER_TYPE_SCHEMA, 'Received invalid UserType object')

const getUserSchemaId = (value: UserType): string => {
  const url = value[LINKS_FIELD].schema.href
  const id = extractIdFromUrl(url)
  if (_.isString(id)) {
    return id
  }
  log.error('Could not find id for UserSchema value')
  throw new Error('Could not find id for UserSchema value')
}

export const extractSchemaIdFromUserType: definitions.AdjustFunction<definitions.ContextParams, unknown, string> = ({
  value,
}) => {
  if (!isUserType(value)) {
    throw new Error('Invalid enrty for user type')
  }
  const schemaId = getUserSchemaId(value)
  return { value: schemaId }
}
