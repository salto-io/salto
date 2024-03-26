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
import { ARTICLE_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'


export const ADDITIONAL_PARENT_FIELDS: Record<string, string[]> = {
  [CATEGORY_TYPE_NAME]: ['brand'],
  [SECTION_TYPE_NAME]: ['direct_parent_id', 'category_id', 'brand'],
  [ARTICLE_TYPE_NAME]: ['section_id', 'brand'],
}

/**
 * Filter creators of all the common filters
 */
const filterCreators: Record<string, FilterCreator> = {
  hideTypes: filters.hideTypesFilterCreator(),
  referencedInstanceNames: filters.referencedInstanceNamesFilterCreator(),
  query: filters.queryFilterCreator({
    typesToKeep: [
      'automation_order',
      'organization_field_order',
      'sla_policy_order',
      'ticket_form_order',
      'trigger_order',
      'user_field_order',
      'view_order',
      'workspace_order',
    ],
    additionalParentFields: ADDITIONAL_PARENT_FIELDS,
  }),
}

export default filterCreators
