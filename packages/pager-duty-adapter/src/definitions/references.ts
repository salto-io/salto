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
import { Options } from './types'
import { ESCALATION_POLICY_TYPE_NAME, SCHEDULE_TYPE_NAME, SERVICE_TYPE_NAME, TEAM_TYPE_NAME } from '../constants'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'id', parentTypes: ['service__escalation_policy'] },
    serializationStrategy: 'id',
    target: { type: ESCALATION_POLICY_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['escalationPolicy__escalation_rules__targets'] },
    serializationStrategy: 'id',
    target: { type: SCHEDULE_TYPE_NAME },
  },
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
    target: { type: TEAM_TYPE_NAME },
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
    target: { type: SERVICE_TYPE_NAME },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
}
