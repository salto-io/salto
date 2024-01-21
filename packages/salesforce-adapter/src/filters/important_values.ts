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
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { ImportantValue } from '@salto-io/adapter-utils'
import { isMetadataObjectType, MetadataObjectType } from '../transformers/transformer'
import { LocalFilterCreator } from '../filter'


const highligheted = (value: string): ImportantValue => ({
  value,
  highlighted: true,
  indexed: false,
})

const highlightedAndIndexed = (value: string): ImportantValue => (
  {
    value,
    highlighted: true,
    indexed: true,
  }
)

const importantValues: ImportantValue[] = [
  highligheted('fullName'),
  highligheted('label'),
  highligheted('masterLabel'),
  highligheted('name'),
  highligheted('content'),
  highligheted('description'),
  highligheted('processType'),
  highligheted('relatedLists'),
  highligheted('layoutSections'),
  highligheted('lwcResources'),
  highlightedAndIndexed('apiVersion'),
  highlightedAndIndexed('status'),
  highlightedAndIndexed('active'),
]

const addImportantValues = (type: MetadataObjectType): void => {
  const typeFields = new Set(Object.keys(type.fields))
  const typeImportantValues = importantValues
    .filter(importantValue => typeFields.has(importantValue.value))
  if (typeImportantValues.length > 0) {
    type.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValues
      .filter(importantValue => typeFields.has(importantValue.value))
  }
}

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'salesforceImportantValuesFilter',
  onFetch: async elements => {
    if (!config.fetchProfile.isFeatureEnabled('importantValues')) {
      return
    }
    elements
      .filter(isMetadataObjectType)
      .forEach(addImportantValues)
  },
})


export default filterCreator
