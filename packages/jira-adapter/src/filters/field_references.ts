/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { referencesRules, JiraFieldReferenceResolver } from '../reference_mapping'
import { FilterCreator } from '../filter'

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({
      elements,
      fieldsToGroupBy: ['id', 'name', 'originalName'],
      defs: referencesRules,
      isEqualValue: (lhs, rhs) => _.toString(lhs) === _.toString(rhs),
      fieldReferenceResolverCreator: defs => new JiraFieldReferenceResolver(defs),
    })
  },
})

export default filter
