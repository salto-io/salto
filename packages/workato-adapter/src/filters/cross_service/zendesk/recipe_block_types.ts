/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
