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
import { elements as elementUtils, references as referenceUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const { toNestedTypeName } = elementUtils.ducktype

const fieldNameToTypeMappingDefs: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_client' },
  },
  {
    src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'api_collection_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'flow_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'recipe' },
  },
  {
    src: { field: 'parent_id', parentTypes: ['folder'] },
    serializationStrategy: 'id',
    target: { type: 'folder' },
  },
  {
    src: { field: 'account_id', parentTypes: [toNestedTypeName('recipe', 'config')] },
    serializationStrategy: 'id',
    target: { type: 'connection' },
  },
  {
    src: { field: 'folder_id', parentTypes: ['recipe', 'connection'] },
    serializationStrategy: 'id',
    target: { type: 'folder' },
  },
]

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({ elements, defs: fieldNameToTypeMappingDefs })
  },
})

export default filter
