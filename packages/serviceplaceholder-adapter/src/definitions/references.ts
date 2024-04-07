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
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
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

  // The parent_id type can differ based on the parent_type field
  {
    src: { instanceTypes: ['made_up_type_a'], field: 'parent_id' },
    serializationStrategy: 'id',
    sourceTransformation: 'asString',
    target: {
      typeContext: 'parentType',
    },
  },
  // the reference is by otherFieldName
  {
    src: { instanceTypes: ['made_up_type_a'], field: 'other_b' },
    serializationStrategy: 'otherFieldName',
    sourceTransformation: 'asString',
    target: { type: 'made_up_type_b' },
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

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  // TODO remove if not needed
  contextStrategyLookup: {
    parentType: ({ instance }) => _.get(instance.value, 'parent_type'),
  },
  serializationStrategyLookup: {
    otherFieldName: {
      serialize: ({ ref }) => ref.value.value.otherFieldName,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'otherFieldName',
    },
  },
  fieldsToGroupBy: ['id', 'name', 'otherFieldName'],
}
