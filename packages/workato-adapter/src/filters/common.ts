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
import { filters } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { FOLDER_TYPE, RECIPE_TYPE, CONNECTION_TYPE, RECIPE_CODE_TYPE } from '../constants'

const ADDITIONAL_PARENT_FIELDS: Record<string, string[]> = {
  [FOLDER_TYPE]: ['parent_id'],
  [RECIPE_TYPE]: ['folder_id'],
  [CONNECTION_TYPE]: ['folder_id'],
}

/**
 * Filter creators of all the common filters
 */
const filterCreators: Record<string, FilterCreator> = {
  hideTypes: filters.hideTypesFilterCreator(),
  referencedInstanceNames: filters.referencedInstanceNamesFilterCreatorDeprecated(),
  query: filters.queryFilterCreator({
    additionalParentFields: ADDITIONAL_PARENT_FIELDS,
    typesToKeep: [RECIPE_CODE_TYPE],
  }),
}

export default filterCreators
