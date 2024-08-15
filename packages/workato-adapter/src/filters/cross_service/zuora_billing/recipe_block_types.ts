/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { CROSS_SERVICE_SUPPORTED_APPS } from '../../../constants'
import { BlockBase } from '../recipe_block_types'

export type ZuoraBlock = BlockBase & {
  as: string
  provider: 'zuora'
  input: {
    object: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isZuoraBlock = (value: any, application: string): value is ZuoraBlock =>
  _.isObjectLike(value) &&
  CROSS_SERVICE_SUPPORTED_APPS.zuora_billing.includes(application) &&
  value.provider === application &&
  _.isString(value.keyword) &&
  _.isObjectLike(value.input) &&
  _.isString(value.input.object) &&
  _.isString(value.as)
