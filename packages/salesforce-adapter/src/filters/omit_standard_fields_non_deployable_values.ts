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

import { FIELD_ANNOTATIONS } from '../constants'
import { LocalFilterCreator } from '../filter'
import {
  ensureSafeFilterFetch,
  isCustomObjectSync,
  isStandardField,
} from './utils'

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'omitStandardFieldsNonDeployableValues',
  onFetch: ensureSafeFilterFetch({
    config,
    filterName: 'omitStandardFieldsNonDeployableValues',
    warningMessage:
      'Error occurred when attempting to omit standard fields non deployable values',
    fetchFilterFunc: async (elements) =>
      elements
        .filter(isCustomObjectSync)
        .flatMap((customObject) => Object.values(customObject.fields))
        .filter(isStandardField)
        .forEach((field) => {
          delete field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
          delete field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]
        }),
  }),
})

export default filterCreator
