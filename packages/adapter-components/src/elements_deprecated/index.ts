/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import * as ducktype from './ducktype'
import * as swagger from './swagger'
import * as query from '../fetch/query'
import { RECORDS_PATH, TYPES_PATH, SUBTYPES_PATH, SETTINGS_NESTED_PATH } from '../fetch/element/constants'
import { findDataField, returnFullEntry, FindNestedFieldFunc } from './field_finder'
import { filterTypes } from './type_elements'
import { getInstanceName, generateInstanceNameFromConfig, toBasicInstance } from './instance_elements'
import { createServiceIDs as createServiceIds } from '../fetch/element/id_utils'
import { removeNullValues, removeNullValuesTransformFunc } from '../fetch/element/type_utils'

export {
  ducktype,
  swagger,
  findDataField,
  returnFullEntry,
  FindNestedFieldFunc,
  RECORDS_PATH,
  TYPES_PATH,
  SUBTYPES_PATH,
  SETTINGS_NESTED_PATH,
  filterTypes,
  getInstanceName,
  generateInstanceNameFromConfig,
  createServiceIds,
  removeNullValues,
  removeNullValuesTransformFunc,
  query,
  toBasicInstance,
}
