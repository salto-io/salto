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
import { validatePlainObject } from '@salto-io/adapter-utils'
import { TYPE_NAME_TO_READ_ONLY_FIELDS } from '../../../change_validators'
import { AdjustFunction } from '../types'

export const omitReadOnlyFields: AdjustFunction = ({ typeName, value, context }) => {
  validatePlainObject(value, typeName)
  const readOnlyFieldsToOmit = TYPE_NAME_TO_READ_ONLY_FIELDS[typeName]
  if (readOnlyFieldsToOmit === undefined || context.action !== 'modify') {
    return { value }
  }
  return { value: _.omit(value, readOnlyFieldsToOmit) }
}
