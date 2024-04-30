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
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { LABEL_TYPE_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME, TEMPLATE_TYPE_NAMES } from '../constants'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'spaceId' },
    serializationStrategy: 'id',
    target: { type: SPACE_TYPE_NAME },
    sourceTransformation: 'asString',
  },
  {
    src: { field: 'parentId', parentTypes: [PAGE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: PAGE_TYPE_NAME },
  },
  // This rule should be defined before the same rule with serializationStrategy = 'id'
  {
    src: { field: 'labels', parentTypes: TEMPLATE_TYPE_NAMES },
    serializationStrategy: 'fullValue',
    target: { type: LABEL_TYPE_NAME },
  },
  {
    src: { field: 'labels', parentTypes: TEMPLATE_TYPE_NAMES },
    serializationStrategy: 'id',
    target: { type: LABEL_TYPE_NAME },
  },
  {
    src: { field: 'homepage', parentTypes: [SPACE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: PAGE_TYPE_NAME },
  },
]

export const REFERENCES: definitions.ApiDefinitions['references'] = {
  rules: REFERENCE_RULES,
}
