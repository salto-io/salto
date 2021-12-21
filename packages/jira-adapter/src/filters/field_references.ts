/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const fieldNameToTypeMappingDefs: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'issueTypeId', parentTypes: ['IssueTypeSchemeMapping', 'IssueTypeScreenSchemeItem', 'FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'IssueTypeDetails' },
  },
  {
    src: { field: 'fieldConfigurationId', parentTypes: ['FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'FieldConfigurationDetails' },
  },
  {
    src: { field: 'screenSchemeId', parentTypes: ['IssueTypeScreenSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: 'ScreenScheme' },
  },
]

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({
      elements,
      defs: fieldNameToTypeMappingDefs,
      isEqualValue: (lhs, rhs) => _.toString(lhs) === _.toString(rhs),
    })
  },
})

export default filter
