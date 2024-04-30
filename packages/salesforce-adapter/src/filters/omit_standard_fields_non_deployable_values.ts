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

import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FIELD_ANNOTATIONS } from '../constants'
import { LocalFilterCreator } from '../filter'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  isCustomObjectSync,
  isStandardField,
  isStandardPicklistFieldWithValueSet,
} from './utils'

const log = logger(module)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'omitStandardFieldsNonDeployableValues',
  onFetch: ensureSafeFilterFetch({
    config,
    filterName: 'omitStandardFieldsNonDeployableValues',
    warningMessage:
      'Error occurred when attempting to omit standard fields non deployable values',
    fetchFilterFunc: async (elements) => {
      const standardFields = elements
        .filter(isCustomObjectSync)
        .flatMap((customObject) => Object.values(customObject.fields))
        .filter(isStandardField)
      const standardFieldsWithValueSet = standardFields.filter(
        isStandardPicklistFieldWithValueSet,
      )
      ;(standardFieldsWithValueSet.length > 100 ? log.trace : log.debug)(
        'omitting valueSet from the following standard fields: %s',
        safeJsonStringify(
          standardFieldsWithValueSet.map((field) => apiNameSync(field)),
        ),
      )

      standardFields.forEach((field) => {
        if (field.annotations[FIELD_ANNOTATIONS.VALUE_SET] !== undefined) {
          delete field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
        }
      })
    },
  }),
})

export default filterCreator
