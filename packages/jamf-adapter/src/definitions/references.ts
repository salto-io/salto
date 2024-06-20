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
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from './types'
import { CATEGORY_TYPE_NAME, CLASS_TYPE_NAME, PACKAGE_TYPE_NAME, SCRIPT_TYPE_NAME, SITE_TYPE_NAME } from '../constants'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: { field: 'categoryId' },
    serializationStrategy: 'id',
    target: { type: CATEGORY_TYPE_NAME },
  },
  {
    src: { field: 'site', parentTypes: [CLASS_TYPE_NAME] },
    serializationStrategy: 'fullValue',
    target: { type: SITE_TYPE_NAME },
  },
  {
    src: { field: 'site', parentTypes: [CLASS_TYPE_NAME] },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: SITE_TYPE_NAME },
  },
  {
    src: { field: 'category' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: CATEGORY_TYPE_NAME },
  },
  {
    src: { field: 'scripts' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: SCRIPT_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['policy__package_configuration__packages'] },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: PACKAGE_TYPE_NAME },
  },
]

export const REFERENCES: definitions.ApiDefinitions['references'] = {
  rules: REFERENCE_RULES,
}
