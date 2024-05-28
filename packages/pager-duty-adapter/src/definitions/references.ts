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
import _ from 'lodash'
import { Value } from '@salto-io/adapter-api'
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: { field: 'id', parentTypes: ['service__escalation_policy'] },
    serializationStrategy: 'id',
    target: { type: 'escalationPolicy' },
  },
  {
    src: { field: 'id', parentTypes: ['escalationPolicy__escalation_rules__targets'] },
    serializationStrategy: 'id',
    target: { type: 'schedule' },
  },
  // {
  //   src: { field: 'escalation_policy', parentTypes: ['service'] },
  //   serializationStrategy: 'escalationPolicy',
  //   target: { type: 'escalationPolicy' },
  // },
  {
    src: {
      field: 'id',
      parentTypes: [
        'service__teams',
        'team__parent',
        'businessService__team',
        'escalationPolicy__teams',
        'schedule__teams',
        'eventOrchestration__team',
      ],
    },
    serializationStrategy: 'id',
    target: { type: 'team' },
  },
  {
    src: {
      field: 'route_to',
      parentTypes: [
        'eventOrchestration__eventOrchestrationsRouter__catch_all__actions',
        'eventOrchestration__eventOrchestrationsRouter__sets__rules__actions',
      ],
    },
    serializationStrategy: 'id',
    target: { type: 'service' },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  // TODO remove if not needed
  contextStrategyLookup: {
    parentType: ({ instance }) => _.get(instance.value, 'parent_type'),
  },
  serializationStrategyLookup: {
    escalationPolicy: {
      serialize: ({ ref }) => ({ id: ref.value.value.id, summary: ref.value.value.summary }) as Value,
      lookup: val => val.id,
      lookupIndexName: 'escalationPolicy',
    },
  },
  fieldsToGroupBy: ['id', 'name'],
}
