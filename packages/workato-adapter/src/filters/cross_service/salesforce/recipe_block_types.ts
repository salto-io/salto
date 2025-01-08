/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { SALESFORCE, CROSS_SERVICE_SUPPORTED_APPS } from '../../../constants'
import { BlockBase, isListItem, RefListItem } from '../recipe_block_types'

export type SalesforceBlock = BlockBase & {
  as: string
  provider: 'salesforce' | 'salesforce_secondary'
  dynamicPickListSelection: {
    sobject_name: string
    field_list?: RefListItem[]
    table_list?: RefListItem[]
  }
  input: {
    sobject_name: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSalesforceBlock = (value: any, application: string): value is SalesforceBlock =>
  _.isObjectLike(value) &&
  CROSS_SERVICE_SUPPORTED_APPS[SALESFORCE].includes(application) &&
  value.provider === application &&
  _.isString(value.keyword) &&
  _.isObjectLike(value.dynamicPickListSelection) &&
  _.isString(value.dynamicPickListSelection.sobject_name) &&
  (value.dynamicPickListSelection.table_list ?? []).every(isListItem) &&
  (value.dynamicPickListSelection.field_list ?? []).every(isListItem) &&
  _.isObjectLike(value.input) &&
  _.isString(value.input.sobject_name) &&
  _.isString(value.as)
