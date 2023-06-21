/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { referencesRules, JiraFieldReferenceResolver, contextStrategyLookup } from '../reference_mapping'
import { FilterCreator } from '../filter'

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const fixedDefs = referencesRules
      .map(def => (
        config.fetch.enableMissingReferences ? def : _.omit(def, 'jiraMissingRefStrategy')
      ))
    await referenceUtils.addReferences({
      elements,
      fieldsToGroupBy: ['id', 'name', 'originalName', 'groupId', 'key'],
      defs: fixedDefs,
      contextStrategyLookup,
      fieldReferenceResolverCreator: defs => new JiraFieldReferenceResolver(defs),
    })
  },
})

export default filter
