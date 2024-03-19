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

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<never>[] = [
  // TODO adjust and remove unneeded examples and documentation

  // all fields called group_id or group_ids are assumed to reference group instances by their id field
  {
    src: { field: 'group_id' },
    serializationStrategy: 'id',
    target: { type: 'group' },
  },
  {
    src: { field: 'group_ids' },
    serializationStrategy: 'id',
    target: { type: 'group' },
  },

  // the field active under ticket_form_order instances is assumed to reference a ticket_form instance
  {
    src: { field: 'active', parentTypes: ['ticket_form_order'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },

  // the field id under the (nested) types
  // ticket_form__end_user_conditions__child_fields, ticket_form__agent_conditions__child_fields
  // (in practice, these are in nested fields of ticket_form instances)
  // points to a ticket_field
  {
    src: {
      field: 'id',
      parentTypes: ['ticket_form__end_user_conditions__child_fields', 'ticket_form__agent_conditions__child_fields'],
    },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
]

export const REFERENCES: definitions.ApiDefinitions['references'] = {
  rules: REFERENCE_RULES,
}
