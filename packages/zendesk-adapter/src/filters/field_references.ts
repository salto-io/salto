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
import { Element, ElemID, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { BRAND_NAME } from '../constants'
import { FETCH_CONFIG } from '../config'

const { neighborContextGetter } = referenceUtils
const log = logger(module)

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
  getLookUpName?: GetLookupNameFunc
}): referenceUtils.ContextFunc => neighborContextGetter({
  getLookUpName: async ({ ref }) => ref.elemID.name,
  ...args,
})

const SPECIAL_CONTEXT_NAMES: Record<string, string> = {
  schedule_id: 'business_hours_schedule',
  within_schedule: 'business_hours_schedule',
  set_schedule: 'business_hours_schedule',
  notification_target: 'target',
  notification_group: 'group',
  notification_sms_group: 'group',
  notification_webhook: 'webhook',
  via_id: 'channel',
  current_via_id: 'channel',
  current_tags: 'tag',
  set_tags: 'tag',
  remove_tags: 'tag',
}

/**
 * For strings with an id-related suffix (_id or _ids), remove the suffix.
 * e.g. `abc_id` => `abc`.
 */
const getValueLookupType: referenceUtils.ContextValueMapperFunc = val => {
  const specialTypeName = SPECIAL_CONTEXT_NAMES[val]
  if (specialTypeName !== undefined) {
    return specialTypeName
  }
  const valParts = val.split('_')
  const lastPart = valParts.pop()
  if (lastPart === undefined || !['id', 'ids'].includes(lastPart)) {
    return undefined
  }
  return valParts.join('_')
}

const getLowerCaseSingularLookupType: referenceUtils.ContextValueMapperFunc = val => {
  const lowercaseVal = val.toLowerCase()
  // for now this simple conversion to singular form seems good enough, but
  // we may need to improve it later on
  if (lowercaseVal.endsWith('s')) {
    return lowercaseVal.slice(0, -1)
  }
  return lowercaseVal
}

const TICKET_FIELD_PREFIX = 'custom_fields_'
const TICKET_FIELD_ALTERNATIVE_PREFIX = 'ticket_fields_'
const ORG_FIELD_PREFIX = 'organization.custom_fields.'
const USER_FIELD_PREFIX = 'requester.custom_fields.'
const TICKET_FIELD_TYPE_NAME = 'ticket_field'
const ORG_FIELD_TYPE_NAME = 'organization_field'
const USER_FIELD_TYPE_NAME = 'user_field'
const TICKET_FIELD_OPTION_TYPE_NAME = 'ticket_field__custom_field_options'
const ORG_FIELD_OPTION_TYPE_NAME = 'organization_field__custom_field_options'
const USER_FIELD_OPTION_TYPE_NAME = 'user_field__custom_field_options'

const customFieldOptionSerialization: GetLookupNameFunc = ({ ref }) => {
  const fieldName = ref.elemID.typeName === TICKET_FIELD_OPTION_TYPE_NAME ? 'value' : 'id'
  return isInstanceElement(ref.value) ? ref.value.value[fieldName]?.toString() : ref.value
}

const neighborReferenceTicketFieldLookupFunc: GetLookupNameFunc = async ({ ref }) => {
  if (isInstanceElement(ref.value)) {
    if (ref.elemID.typeName === TICKET_FIELD_TYPE_NAME
      && ['multiselect', 'tagger'].includes(ref.value.value.type)) {
      return TICKET_FIELD_OPTION_TYPE_NAME
    }
  }
  return undefined
}

const neighborReferenceTicketFieldLookupType: referenceUtils.ContextValueMapperFunc = val =>
  (val === TICKET_FIELD_OPTION_TYPE_NAME ? val : undefined)

const neighborReferenceUserAndOrgFieldLookupFunc: GetLookupNameFunc = async ({ ref }) => {
  if (isInstanceElement(ref.value) && ref.value.value.type === 'dropdown') {
    if (ref.elemID.typeName === USER_FIELD_TYPE_NAME) {
      return USER_FIELD_OPTION_TYPE_NAME
    }
    if (ref.elemID.typeName === ORG_FIELD_TYPE_NAME) {
      return ORG_FIELD_OPTION_TYPE_NAME
    }
  }
  return undefined
}

const neighborReferenceUserAndOrgFieldLookupType: referenceUtils.ContextValueMapperFunc = val =>
  ([USER_FIELD_OPTION_TYPE_NAME, ORG_FIELD_OPTION_TYPE_NAME].includes(val) ? val : undefined)

const getSerializationStrategyOfCustomFieldByContainingType = (
  prefix: string,
  lookupIndexName = 'id',
  ticketFieldPrefix = TICKET_FIELD_PREFIX,
): referenceUtils.ReferenceSerializationStrategy => {
  const serialize: GetLookupNameFunc = ({ ref }) => {
    if (isInstanceElement(ref.value)) {
      // eslint-disable-next-line default-case
      switch (ref.elemID.typeName) {
        case TICKET_FIELD_TYPE_NAME: {
          return `${ticketFieldPrefix}${ref.value.value.id?.toString()}`
        }
        case ORG_FIELD_TYPE_NAME: {
          return `${ORG_FIELD_PREFIX}${ref.value.value.key?.toString()}`
        }
        case USER_FIELD_TYPE_NAME: {
          return `${USER_FIELD_PREFIX}${ref.value.value.key?.toString()}`
        }
      }
    }
    return ref.value
  }
  const lookup: referenceUtils.LookupFunc = val =>
    ((_.isString(val) && val.startsWith(prefix)) ? val.slice(prefix.length) : val)
  return { serialize, lookup, lookupIndexName }
}

type ZendeskReferenceSerializationStrategyName = 'ticketField'
  | 'value'
  | 'localeId'
  | 'orgField'
  | 'userField'
  | 'ticketFieldAlternative'
  | 'ticketFieldOption'
  | 'userFieldOption'
const ZendeskReferenceSerializationStrategyLookup: Record<
  ZendeskReferenceSerializationStrategyName
  | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  ticketField: getSerializationStrategyOfCustomFieldByContainingType(TICKET_FIELD_PREFIX),
  ticketFieldAlternative: getSerializationStrategyOfCustomFieldByContainingType(
    TICKET_FIELD_ALTERNATIVE_PREFIX, 'id', TICKET_FIELD_ALTERNATIVE_PREFIX
  ),
  orgField: getSerializationStrategyOfCustomFieldByContainingType(ORG_FIELD_PREFIX, 'key'),
  userField: getSerializationStrategyOfCustomFieldByContainingType(USER_FIELD_PREFIX, 'key'),
  value: {
    serialize: ({ ref }) => (isInstanceElement(ref.value) ? ref.value.value.value : ref.value),
    lookup: val => val,
    lookupIndexName: 'value',
  },
  localeId: {
    serialize: ({ ref }) => (
      isInstanceElement(ref.value) ? ref.value.value.locale_id.value.value.id : ref.value
    ),
    lookup: val => val,
    lookupIndexName: 'localeId',
  },
  ticketFieldOption: {
    serialize: customFieldOptionSerialization,
    lookup: val => val,
    lookupIndexName: 'value',
  },
  userFieldOption: {
    serialize: customFieldOptionSerialization,
    lookup: val => val,
    lookupIndexName: 'id',
  },
}

export type ReferenceContextStrategyName = 'neighborField'
  | 'neighborType'
  | 'parentSubject'
  | 'parentTitle'
  | 'parentValue'
  | 'neighborSubject'
  | 'neighborReferenceTicketField'
  | 'neighborReferenceTicketFormCondition'
  | 'neighborReferenceUserAndOrgField'
  | 'neighborSubjectReferenceTicketField'
  | 'neighborSubjectReferenceUserAndOrgField'
export const contextStrategyLookup: Record<
  ReferenceContextStrategyName, referenceUtils.ContextFunc
> = {
  neighborField: neighborContextFunc({ contextFieldName: 'field', contextValueMapper: getValueLookupType }),
  neighborReferenceTicketField: neighborContextFunc({ contextFieldName: 'field', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborReferenceTicketFormCondition: neighborContextFunc({ contextFieldName: 'parent_field_id', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborReferenceUserAndOrgField: neighborContextFunc({ contextFieldName: 'field', getLookUpName: neighborReferenceUserAndOrgFieldLookupFunc, contextValueMapper: neighborReferenceUserAndOrgFieldLookupType }),
  neighborSubjectReferenceTicketField: neighborContextFunc({ contextFieldName: 'subject', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborSubjectReferenceUserAndOrgField: neighborContextFunc({ contextFieldName: 'subject', getLookUpName: neighborReferenceUserAndOrgFieldLookupFunc, contextValueMapper: neighborReferenceUserAndOrgFieldLookupType }),
  neighborType: neighborContextFunc({ contextFieldName: 'type', contextValueMapper: getLowerCaseSingularLookupType }),
  parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: getValueLookupType }),
  neighborSubject: neighborContextFunc({ contextFieldName: 'subject', contextValueMapper: getValueLookupType }),
  parentTitle: neighborContextFunc({ contextFieldName: 'title', levelsUp: 1, contextValueMapper: getValueLookupType }),
  parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: getValueLookupType }),
}

const MISSING_REF_PREFIX = 'missing_'
export const ZendeskMissingReferenceStrategyLookup: Record<
referenceUtils.MissingReferenceStrategyName, referenceUtils.MissingReferenceStrategy
> = {
  typeAndValue: {
    create: ({ value, adapter, typeName }) => {
      if (!_.isString(typeName) || !value) {
        return undefined
      }
      return new InstanceElement(
        naclCase(`${MISSING_REF_PREFIX}${value}`),
        new ObjectType({ elemID: new ElemID(adapter, typeName) }),
        {},
        undefined,
        { [referenceUtils.MISSING_ANNOTATION]: true },
      )
    },
  },
}

type ZendeskFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategyName
> & {
  zendeskSerializationStrategy?: ZendeskReferenceSerializationStrategyName
  zendeskMissingRefStrategy?: referenceUtils.MissingReferenceStrategyName
}

export class ZendeskFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
  ReferenceContextStrategyName
> {
  constructor(def: ZendeskFieldReferenceDefinition) {
    super({ src: def.src })
    this.serializationStrategy = ZendeskReferenceSerializationStrategyLookup[
      def.zendeskSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.missingRefStrategy = def.zendeskMissingRefStrategy
      ? ZendeskMissingReferenceStrategyLookup[def.zendeskMissingRefStrategy]
      : undefined
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }
}

const firstIterationFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  {
    src: { field: 'brand_id' },
    serializationStrategy: 'id',
    target: { type: BRAND_NAME },
  },
  {
    src: { field: 'brand_ids' },
    serializationStrategy: 'id',
    target: { type: BRAND_NAME },
  },
  {
    src: { field: 'default_brand_id' },
    serializationStrategy: 'id',
    target: { type: BRAND_NAME },
  },
  {
    src: { field: 'restricted_brand_ids' },
    serializationStrategy: 'id',
    target: { type: BRAND_NAME },
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
    src: { field: 'variants', parentTypes: ['dynamic_content_item'] },
    zendeskSerializationStrategy: 'localeId',
    target: { type: 'dynamic_content_item__variants' },
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
    src: { field: 'active', parentTypes: ['ticket_form_order'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },
  {
    src: { field: 'inactive', parentTypes: ['ticket_form_order'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_form' },
  },
  {
    src: { field: 'active', parentTypes: ['organization_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'organization_field' },
  },
  {
    src: { field: 'inactive', parentTypes: ['organization_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'organization_field' },
  },
  {
    src: { field: 'active', parentTypes: ['user_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'user_field' },
  },
  {
    src: { field: 'inactive', parentTypes: ['user_field_order'] },
    serializationStrategy: 'id',
    target: { type: 'user_field' },
  },
  {
    src: { field: 'active', parentTypes: ['workspace_order'] },
    serializationStrategy: 'id',
    target: { type: 'workspace' },
  },
  {
    src: { field: 'inactive', parentTypes: ['workspace_order'] },
    serializationStrategy: 'id',
    target: { type: 'workspace' },
  },
  {
    src: { field: 'active', parentTypes: ['sla_policy_order'] },
    serializationStrategy: 'id',
    target: { type: 'sla_policy' },
  },
  {
    src: { field: 'active', parentTypes: ['automation_order'] },
    serializationStrategy: 'id',
    target: { type: 'automation' },
  },
  {
    src: { field: 'inactive', parentTypes: ['automation_order'] },
    serializationStrategy: 'id',
    target: { type: 'automation' },
  },
  {
    src: { field: 'active', parentTypes: ['view_order'] },
    serializationStrategy: 'id',
    target: { type: 'view' },
  },
  {
    src: { field: 'inactive', parentTypes: ['view_order'] },
    serializationStrategy: 'id',
    target: { type: 'view' },
  },
  {
    src: { field: 'active', parentTypes: ['trigger_order_entry'] },
    serializationStrategy: 'id',
    target: { type: 'trigger' },
  },
  {
    src: { field: 'inactive', parentTypes: ['trigger_order_entry'] },
    serializationStrategy: 'id',
    target: { type: 'trigger' },
  },
  {
    src: { field: 'category', parentTypes: ['trigger_order_entry'] },
    serializationStrategy: 'id',
    target: { type: 'trigger_category' },
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
    src: { field: 'parent_field_id' },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: {
      field: 'id',
      parentTypes: [
        'ticket_form__end_user_conditions__child_fields',
        'ticket_form__agent_conditions__child_fields',
      ],
    },
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
    zendeskSerializationStrategy: 'value',
    target: { type: 'ticket_field__custom_field_options' },
  },
  {
    src: { field: 'custom_field_options', parentTypes: ['user_field'] },
    serializationStrategy: 'fullValue',
    target: { type: 'user_field__custom_field_options' },
  },
  {
    src: { field: 'default_custom_field_option', parentTypes: ['user_field'] },
    zendeskSerializationStrategy: 'value',
    target: { type: 'user_field__custom_field_options' },
  },
  {
    src: {
      field: 'field',
      parentTypes: [
        'view__conditions__all',
        'view__conditions__any',
        'macro__actions',
        'trigger__conditions__all',
        'trigger__conditions__any',
        'trigger__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'automation__actions',
      ],
    },
    zendeskSerializationStrategy: 'ticketField',
    target: { type: 'ticket_field' },
  },
  {
    src: {
      field: 'subject',
      parentTypes: [
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'ticketField',
    target: { type: 'ticket_field' },
  },
  {
    src: {
      field: 'field',
      parentTypes: [
        'sla_policy__filter__all',
        'sla_policy__filter__any',
      ],
    },
    zendeskSerializationStrategy: 'ticketFieldAlternative',
    target: { type: 'ticket_field' },
  },
  {
    src: {
      field: 'field',
      parentTypes: [
        'trigger__conditions__all',
        'trigger__conditions__any',
        'trigger__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'automation__actions',
        'sla_policy__filter__all',
        'sla_policy__filter__any',
      ],
    },
    zendeskSerializationStrategy: 'orgField',
    target: { type: 'organization_field' },
  },
  {
    src: {
      field: 'subject',
      parentTypes: [
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'orgField',
    target: { type: 'organization_field' },
  },
  {
    src: {
      field: 'field',
      parentTypes: [
        'trigger__conditions__all',
        'trigger__conditions__any',
        'trigger__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'automation__actions',
        'sla_policy__filter__all',
        'sla_policy__filter__any',
      ],
    },
    zendeskSerializationStrategy: 'userField',
    target: { type: 'user_field' },
  },
  {
    src: {
      field: 'subject',
      parentTypes: [
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'userField',
    target: { type: 'user_field' },
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
    src: { field: 'section_id' },
    serializationStrategy: 'id',
    target: { type: 'section' },
  },
  {
    src: { field: 'category_id', parentTypes: ['section'] },
    serializationStrategy: 'id',
    target: { type: 'category' },
  },
  {
    src: { field: 'user_segment_id' },
    serializationStrategy: 'id',
    target: { type: 'user_segment' },
  },
  {
    src: { field: 'permission_group_id' },
    serializationStrategy: 'id',
    target: { type: 'permission_group' },
  },
  {
    src: { field: 'organization_ids' },
    serializationStrategy: 'id',
    target: { type: 'organization' },
  },
  {
    src: { field: 'badge_category_id' },
    serializationStrategy: 'id',
    target: { type: 'badge_category' },
  },

  {
    src: {
      field: 'id',
      parentTypes: [
        'view__restriction',
        'macro__restriction',
        'workspace__selected_macros__restriction',
      ],
    },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },
  {
    src: {
      field: 'ids',
      parentTypes: [
        'view__restriction',
        'macro__restriction',
        'workspace__selected_macros__restriction',
      ],
    },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },
  {
    src: { field: 'id', parentTypes: ['workspace__apps'] },
    serializationStrategy: 'id',
    target: { type: 'app_installation' },
  },
  {
    src: { field: 'resource_id' },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborType' },
  },
  {
    src: { field: 'group_by', parentTypes: ['view__execution'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'sort_by', parentTypes: ['view__execution'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__group', 'view__execution__sort'] },
    serializationStrategy: 'id',
    target: { type: 'ticket_field' },
  },
  {
    src: { field: 'attachments', parentTypes: ['macro'] },
    serializationStrategy: 'id',
    target: { type: 'macro_attachment' },
  },
]

const commonFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
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
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborSubject' },
  },
]

const secondIterationFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  {
    src: {
      field: 'value',
      parentTypes: [
        'automation__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'trigger__actions',
        'trigger__conditions__all',
        'trigger__conditions__any',
        'macro__actions',
        'view__conditions__all',
        'view__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'ticketFieldOption',
    target: { typeContext: 'neighborReferenceTicketField' },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'automation__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'trigger__actions',
        'trigger__conditions__all',
        'trigger__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'userFieldOption',
    target: { typeContext: 'neighborReferenceUserAndOrgField' },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'ticketFieldOption',
    target: { typeContext: 'neighborSubjectReferenceTicketField' },
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'ticket_form__end_user_conditions',
        'ticket_form__agent_conditions',
      ],
    },
    zendeskSerializationStrategy: 'ticketFieldOption',
    target: { typeContext: 'neighborReferenceTicketFormCondition' },
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
      ],
    },
    zendeskSerializationStrategy: 'userFieldOption',
    target: { typeContext: 'neighborSubjectReferenceUserAndOrgField' },
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'sla_policy__filter__all',
        'sla_policy__filter__any',
      ],
    },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborReferenceTicketField' },
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'sla_policy__filter__all',
        'sla_policy__filter__any',
      ],
    },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborReferenceUserAndOrgField' },
  },
]

export const fieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  ...firstIterationFieldNameToTypeMappingDefs,
  ...secondIterationFieldNameToTypeMappingDefs,
  ...commonFieldNameToTypeMappingDefs,
]

export const lookupFunc = referenceUtils.generateLookupFunc(
  fieldNameToTypeMappingDefs,
  defs => new ZendeskFieldReferenceResolver(defs)
)

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => log.time(async () => {
    const addReferences = async (refDefs: ZendeskFieldReferenceDefinition[]):
    Promise<void> => {
      const fixedDefs = refDefs
        .map(def => (
          config[FETCH_CONFIG].enableMissingReferences ? def : _.omit(def, 'zendeskMissingRefStrategy')
        ))
      await referenceUtils.addReferences({
        elements,
        defs: fixedDefs,
        fieldsToGroupBy: ['id', 'name', 'key', 'value'],
        contextStrategyLookup,
        // since ids and references to ids vary inconsistently between string/number, allow both
        isEqualValue: (lhs, rhs) => _.toString(lhs) === _.toString(rhs),
        fieldReferenceResolverCreator: defs => new ZendeskFieldReferenceResolver(defs),
      })
    }
    await addReferences(
      [...firstIterationFieldNameToTypeMappingDefs, ...commonFieldNameToTypeMappingDefs]
    )
    await addReferences(secondIterationFieldNameToTypeMappingDefs)
  }, 'Field reference filter'),
})

export default filter
