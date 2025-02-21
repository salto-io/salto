/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  LIST_ID_PREFIX,
  MAP_ID_PREFIX,
  GENERIC_ID_SUFFIX,
  GENERIC_ID_PREFIX,
  PrimitiveTypes,
} from '@salto-io/adapter-api'

export const Keywords = {
  TYPE_DEFINITION: 'type',
  VARIABLES_DEFINITION: 'vars',
  SETTINGS_DEFINITION: 'settings',
  TYPE_INHERITANCE_SEPARATOR: 'is',
  ANNOTATIONS_DEFINITION: 'annotations',
  NAMESPACE_SEPARATOR: '.',

  // Primitive types
  TYPE_STRING: 'string',
  TYPE_NUMBER: 'number',
  TYPE_BOOL: 'boolean',
  TYPE_OBJECT: 'object',
  TYPE_UNKNOWN: 'unknown',

  // Generics Types
  GENERICS_SUFFIX: `${GENERIC_ID_SUFFIX}`,
  LIST_PREFIX: `${LIST_ID_PREFIX}${GENERIC_ID_PREFIX}`,
  MAP_PREFIX: `${MAP_ID_PREFIX}${GENERIC_ID_PREFIX}`,
}

export const keywordToPrimitiveType: Record<string, PrimitiveTypes> = {
  [Keywords.TYPE_STRING]: PrimitiveTypes.STRING,
  [Keywords.TYPE_NUMBER]: PrimitiveTypes.NUMBER,
  [Keywords.TYPE_BOOL]: PrimitiveTypes.BOOLEAN,
  [Keywords.TYPE_UNKNOWN]: PrimitiveTypes.UNKNOWN,
}

export const primitiveTypeToKeyword = Object.fromEntries(Object.entries(keywordToPrimitiveType).map(([k, v]) => [v, k]))
