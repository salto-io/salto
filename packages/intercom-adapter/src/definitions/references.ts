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
import _ from 'lodash'
import { Options, ReferenceContextStrategies } from './types'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<ReferenceContextStrategies>[] = [
  {
    src: { field: 'parent_id' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      typeContext: 'parentType',
    },
  },
  {
    src: { field: 'parent_id' },
    serializationStrategy: 'id',
    target: {
      type: 'collection',
    },
  },
  {
    src: { field: 'tags' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      type: 'tag',
    },
  },
  {
    src: { field: 'segments' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      type: 'segment',
    },
  },
  {
    src: { field: 'help_center_id' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      type: 'help_center',
    },
  },
  {
    src: { field: 'newsfeed_assignments' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      type: 'newsfeed',
    },
  },
  {
    src: { field: 'default_translation', instanceTypes: ['subscription_type'] },
    serializationStrategy: 'name',
    target: {
      type: 'subscription_type_translation',
    },
  },
  {
    src: { field: 'ticket_type_id' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: { type: 'ticket_type' },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  contextStrategyLookup: {
    parentType: ({ instance }) => _.get(instance.value, 'parent_type'),
  },
}
