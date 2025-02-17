/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { definitions } from '@salto-io/adapter-components'
import { LINKS_FIELD } from '../../../constants'
import { extractIdFromUrl } from '../../../utils'

const log = logger(module)

type UserType = {
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

export const extractSchemaIdFromUserType: definitions.AdjustFunctionSingle<
  definitions.ContextParams,
  unknown,
  string
> = async ({ value }) => {
  if (!isUserType(value)) {
    throw new Error('Invalid enrty for user type')
  }
  const schemaId = getUserSchemaId(value)
  return { value: schemaId }
}
