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
import { LIST_ID_PREFIX, MAP_ID_PREFIX, GENERIC_ID_SUFFIX, GENERIC_ID_PREFIX } from '@salto-io/adapter-api'

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
