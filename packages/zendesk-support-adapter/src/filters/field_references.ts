/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const { neighborContextGetter } = referenceUtils

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
}): referenceUtils.ContextFunc => neighborContextGetter({
  ...args,
  getLookUpName: async ({ ref }) => ref.elemID.name,
})

/**
 * For strings with an id-related suffix (_id or _ids), remove the suffix.
 * e.g. `abc_id` => `abc`.
 */
const getValueLookupType = (val: string): string | undefined => {
  const valParts = val.split('_')
  const lastPart = valParts.pop()
  if (lastPart === undefined || !['id', 'ids'].includes(lastPart)) {
    return undefined
  }
  return valParts.join('_')
}

const getLowerCaseSingularLookupType = (val: string): string | undefined => {
  const lowercaseVal = val.toLowerCase()
  // for now this simple conversion to singular form seems good enough, but
  // we may need to improve it later on
  if (lowercaseVal.endsWith('s')) {
    return lowercaseVal.slice(0, -1)
  }
  return lowercaseVal
}

const CUSTOM_FIELDS_PREFIX = 'custom_fields_'

type ZendeskSupportReferenceSerializationStrategyName = 'customFields' | 'value'
const ZendeskSupportReferenceSerializationStrategyLookup: Record<
  ZendeskSupportReferenceSerializationStrategyName
  | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  customFields: {
    serialize: ({ ref }) => (isInstanceElement(ref.value)
      ? `${CUSTOM_FIELDS_PREFIX}${ref.value.value.id?.toString()}`
      : ref.value),
    lookup: val => ((_.isString(val) && val.startsWith(CUSTOM_FIELDS_PREFIX))
      ? val.slice(CUSTOM_FIELDS_PREFIX.length)
      : val),
    lookupIndexName: 'id',
  },
  value: {
    serialize: ({ ref }) => (isInstanceElement(ref.value) ? ref.value.value.value : ref.value),
    lookup: val => val,
    lookupIndexName: 'value',
  },
}

export type ReferenceContextStrategyName = 'neighborField' | 'neighborType' | 'parentSubject' | 'parentTitle' | 'parentValue'
export const contextStrategyLookup: Record<
  ReferenceContextStrategyName, referenceUtils.ContextFunc
> = {
  neighborField: neighborContextFunc({ contextFieldName: 'field', contextValueMapper: getValueLookupType }),
  neighborType: neighborContextFunc({ contextFieldName: 'type', contextValueMapper: getLowerCaseSingularLookupType }),
  parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: getValueLookupType }),
  parentTitle: neighborContextFunc({ contextFieldName: 'title', levelsUp: 1, contextValueMapper: getValueLookupType }),
  parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: getValueLookupType }),
}

type ZendeskSupportFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategyName
> & {
  zendeskSupportSerializationStrategy?: ZendeskSupportReferenceSerializationStrategyName
}

export class ZendeskSupportFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
  ReferenceContextStrategyName
> {
  constructor(def: ZendeskSupportFieldReferenceDefinition) {
    super({ src: def.src })
    this.serializationStrategy = ZendeskSupportReferenceSerializationStrategyLookup[
      def.zendeskSupportSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }
}

export const fieldNameToTypeMappingDefs: ZendeskSupportFieldReferenceDefinition[] = [
  {
    src: { field: 'brand_id' },
    serializationStrategy: 'id',
    target: { type: 'brand' },
  },
  {
    src: { field: 'brand_ids' },
    serializationStrategy: 'id',
    target: { type: 'brand' },
  },
  {
    src: { field: 'default_brand_id' },
    serializationStrategy: 'id',
    target: { type: 'brand' },
  },
  {
    src: { field: 'category_id' },
    serializationStrategy: 'id',
    target: { type: 'trigger_category' },
  },
  {
    src: { field: 'category_ids' },
    serializationStrategy: 'id',
    target: { type: 'trigger_category' },
  },
  {
    src: { field: 'group_restrictions' },
    serializationStrategy: 'id',
    target: { type: 'group' },
  },
  {
    src: { field: 'group_id' },
    serializationStrategy: 'id',
    target: { type: 'group' },
  },
  {
    src: { field: 'locale_id' },
    serializationStrategy: 'id',
    target: { type: 'locale' },
  },
  {
    src: { field: 'locale_ids' },
    serializationStrategy: 'id',
    target: { type: 'locale' },
  },
  {
    src: { field: 'default_locale_id' },
    serializationStrategy: 'id',
    target: { type: 'locale' },
  },
  {
    src: { field: 'macro_id' },
    serializationStrategy: 'id',
    target: { type: 'macro' },
  },
  {
    src: { field: 'macro_ids' },
    serializationStrategy: 'id',
    target: { type: 'macro' },
  },
  {
    src: { field: 'ticket_form_ids', parentTypes: ['ticket_form_order'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },
  {
    src: { field: 'organization_field_ids', parentTypes: ['organization_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'organization_field' },
  },
  {
    src: { field: 'user_field_ids', parentTypes: ['user_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'user_field' },
  },
  {
    src: { field: 'ids', parentTypes: ['workspace_order'] },
    serializationStrategy: 'id',
    target: { type: 'workspace' },
  },
  {
    src: { field: 'id', parentTypes: ['workspace__selected_macros'] },
    serializationStrategy: 'id',
    target: { type: 'macro' },
  },
  {
    src: { field: 'role_restrictions' },
    serializationStrategy: 'id',
    target: { type: 'custom_role' },
  },
  {
    src: { field: 'ticket_field_id' },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'ticket_field_ids' },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'custom_field_options', parentTypes: ['ticket_field'] },
    serializationStrategy: 'fullValue',
    target: { type: 'ticket_field__custom_field_options' },
  },
  {
    src: { field: 'default_custom_field_option', parentTypes: ['ticket_field'] },
    zendeskSupportSerializationStrategy: 'value',
    target: { type: 'ticket_field__custom_field_options' },
  },
  {
    src: { field: 'custom_field_options', parentTypes: ['user_field'] },
    serializationStrategy: 'fullValue',
    target: { type: 'user_field__custom_field_options' },
  },
  {
    src: { field: 'default_custom_field_option', parentTypes: ['user_field'] },
    zendeskSupportSerializationStrategy: 'value',
    target: { type: 'user_field__custom_field_options' },
  },
  {
    src: { field: 'field', parentTypes: ['view__conditions__all', 'view__conditions__any', 'macro__actions'] },
    zendeskSupportSerializationStrategy: 'customFields',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__columns'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__custom_fields'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'ticket_form_id' },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },
  {
    src: { field: 'ticket_form_ids' },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },
  {
    src: { field: 'skill_based_filtered_views' },
    serializationStrategy: 'id',
    target: { type: 'view' },
  },

  {
    src: { field: 'id', parentTypes: ['view__restriction', 'macro__restriction'] },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },
  {
    src: { field: 'ids', parentTypes: ['view__restriction', 'macro__restriction'] },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },
  {
    src: { field: 'resource_id' },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },

  // only one of these applies in a given instance
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'parentSubject' },
  },
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'parentTitle' },
  },
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'parentValue' },
  },
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborField' },
  },
]

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({
      elements,
      defs: fieldNameToTypeMappingDefs,
      fieldsToGroupBy: ['id', 'name'],
      contextStrategyLookup,
      // since ids and references to ids vary inconsistently between string/number, allow both
      isEqualValue: (lhs, rhs) => _.toString(lhs) === _.toString(rhs),
      fieldReferenceResolverCreator: defs => new ZendeskSupportFieldReferenceResolver(defs),
    })
  },
})

export default filter
