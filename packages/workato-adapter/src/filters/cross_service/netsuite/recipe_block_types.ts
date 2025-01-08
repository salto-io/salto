/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { CROSS_SERVICE_SUPPORTED_APPS, NETSUITE } from '../../../constants'
import { BlockBase, isListItem, RefListItem } from '../recipe_block_types'

export type NetsuiteBlock = BlockBase & {
  provider: 'netsuite' | 'netsuite_secondary'
  dynamicPickListSelection: {
    netsuite_object: string
    custom_list?: RefListItem[]
  }
  input?: {
    netsuite_object: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNetsuiteBlock = (value: any, application: string): value is NetsuiteBlock =>
  _.isObjectLike(value) &&
  CROSS_SERVICE_SUPPORTED_APPS[NETSUITE].includes(application) &&
  value.provider === application &&
  _.isString(value.keyword) &&
  _.isObjectLike(value.dynamicPickListSelection) &&
  _.isString(value.dynamicPickListSelection.netsuite_object) &&
  (value.dynamicPickListSelection.custom_list ?? []).every(isListItem) &&
  _.isObjectLike(value.input) &&
  _.isString(value.input.netsuite_object)
