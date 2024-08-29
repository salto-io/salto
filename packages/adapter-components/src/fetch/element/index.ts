/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export { getNameMapping, createServiceIDs, createElemIDFunc, ElemIDCreator } from './id_utils'
export {
  getContainerForType,
  markServiceIdField,
  toNestedTypeName,
  recursiveNestedTypeName,
  toPrimitiveType,
  overrideFieldTypes,
} from './type_utils'
export { generateInstancesWithInitialTypes } from './instance_element'
export { generateType } from './type_element'
export { getFieldsToOmit } from './instance_utils'
