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
import _ from 'lodash'
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  BRAND_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  FIELD_TYPE_NAMES,
  TICKET_FORM_TYPE_NAME,
  PENDING_CATEGORY,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  OPEN_CATEGORY,
  HOLD_CATEGORY, SOLVED_CATEGORY,
} from '../constants'
import { FETCH_CONFIG } from '../config'
import { ZendeskMissingReferenceStrategyLookup } from './references/missing_references'

const { neighborContextGetter } = referenceUtils

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
  getLookUpName?: GetLookupNameFunc
}): referenceUtils.ContextFunc => neighborContextGetter({
  getLookUpName: async ({ ref }) => ref.elemID.name,
  ...args,
})

const NEIGHBOR_FIELD_TO_TYPE_NAMES: Record<string, string> = {
  brand_id: 'brand',
  group_id: 'group',
  schedule_id: 'business_hours_schedule',
  within_schedule: 'business_hours_schedule',
  set_schedule: 'business_hours_schedule',
  ticket_form_id: TICKET_FORM_TYPE_NAME,
  locale_id: 'locale',
  via_id: 'channel',
  current_via_id: 'channel',
}

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
  if (['user', 'users'].includes(lowercaseVal)) {
    return undefined
  }
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
const ALTERNATE_USER_FIELD_PREFIX = 'user.custom_fields.'
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

const allowListLookupType: referenceUtils.ContextValueMapperFunc = val =>
  (NEIGHBOR_FIELD_TO_TYPE_NAMES[val])

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
  userFieldPrefix = USER_FIELD_PREFIX,
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
          return `${userFieldPrefix}${ref.value.value.key?.toString()}`
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
  | 'userFieldAlternative'
  | 'ticketFieldAlternative'
  | 'ticketFieldOption'
  | 'userFieldOption'
  | 'locale'
  | 'idString'
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
  userFieldAlternative: getSerializationStrategyOfCustomFieldByContainingType(ALTERNATE_USER_FIELD_PREFIX, 'key', undefined, ALTERNATE_USER_FIELD_PREFIX),
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
  locale: {
    serialize: ({ ref }) => (isInstanceElement(ref.value) ? ref.value.value.locale : ref.value),
    lookup: val => val,
    lookupIndexName: 'locale',
  },
  idString: {
    serialize: async ({ ref }) => _.toString(ref.value.value.id),
    lookup: val => val,
    lookupIndexName: 'id',
  },
}

export type ReferenceContextStrategyName = 'neighborField'
  | 'allowlistedNeighborField'
  | 'allowlistedNeighborSubject'
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
  | 'neighborParentType'
export const contextStrategyLookup: Record<
  ReferenceContextStrategyName, referenceUtils.ContextFunc
> = {
  neighborField: neighborContextFunc({ contextFieldName: 'field', contextValueMapper: getValueLookupType }),
  // We use allow lists because there are types we don't support (such organizarion or requester)
  // and they'll as false positives
  allowlistedNeighborField: neighborContextFunc({ contextFieldName: 'field', contextValueMapper: allowListLookupType }),
  allowlistedNeighborSubject: neighborContextFunc({ contextFieldName: 'subject', contextValueMapper: allowListLookupType }),
  neighborReferenceTicketField: neighborContextFunc({ contextFieldName: 'field', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborReferenceTicketFormCondition: neighborContextFunc({ contextFieldName: 'parent_field_id', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborReferenceUserAndOrgField: neighborContextFunc({ contextFieldName: 'field', getLookUpName: neighborReferenceUserAndOrgFieldLookupFunc, contextValueMapper: neighborReferenceUserAndOrgFieldLookupType }),
  neighborSubjectReferenceTicketField: neighborContextFunc({ contextFieldName: 'subject', getLookUpName: neighborReferenceTicketFieldLookupFunc, contextValueMapper: neighborReferenceTicketFieldLookupType }),
  neighborSubjectReferenceUserAndOrgField: neighborContextFunc({ contextFieldName: 'subject', getLookUpName: neighborReferenceUserAndOrgFieldLookupFunc, contextValueMapper: neighborReferenceUserAndOrgFieldLookupType }),
  neighborType: neighborContextFunc({ contextFieldName: 'type', contextValueMapper: getLowerCaseSingularLookupType }),
  neighborParentType: neighborContextFunc({ contextFieldName: 'direct_parent_type' }),
  parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: getValueLookupType }),
  neighborSubject: neighborContextFunc({ contextFieldName: 'subject', contextValueMapper: getValueLookupType }),
  parentTitle: neighborContextFunc({ contextFieldName: 'title', levelsUp: 1, contextValueMapper: getValueLookupType }),
  parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: getValueLookupType }),
}

type ZendeskFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategyName
> & {
  zendeskSerializationStrategy?: ZendeskReferenceSerializationStrategyName
  // Strategy for non-list values. For list values please check listValuesMissingRefereces filter
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
    this.sourceTransformation = referenceUtils.ReferenceSourceTransformationLookup[def.sourceTransformation ?? 'asString']
  }
}

const firstIterationFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  {
    src: { field: 'brand' },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
  },
  {
    src: { field: 'brand_id' },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
  },
  {
    src: { field: 'brand_ids' },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
  },
  {
    src: { field: 'default_brand_id' },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
  },
  {
    src: { field: 'restricted_brand_ids' },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    target: { type: TICKET_FORM_TYPE_NAME },
  },
  {
    src: { field: 'inactive', parentTypes: ['ticket_form_order'] },
    serializationStrategy: 'id',
    target: { type: TICKET_FORM_TYPE_NAME },
  },
  {
    src: { field: 'active', parentTypes: ['organization_field_order'] },
    serializationStrategy: 'id',
    target: { type: ORG_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'inactive', parentTypes: ['organization_field_order'] },
    serializationStrategy: 'id',
    target: { type: ORG_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'active', parentTypes: ['user_field_order'] },
    serializationStrategy: 'id',
    target: { type: USER_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'inactive', parentTypes: ['user_field_order'] },
    serializationStrategy: 'id',
    target: { type: USER_FIELD_TYPE_NAME },
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
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'ticket_field_ids' },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'parent_field_id' },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
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
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'custom_field_options', parentTypes: [TICKET_FIELD_TYPE_NAME] },
    serializationStrategy: 'fullValue',
    target: { type: 'ticket_field__custom_field_options' },
  },
  {
    src: { field: 'default_custom_field_option', parentTypes: [TICKET_FIELD_TYPE_NAME] },
    zendeskSerializationStrategy: 'value',
    target: { type: 'ticket_field__custom_field_options' },
  },
  {
    src: { field: 'custom_field_options', parentTypes: [USER_FIELD_TYPE_NAME] },
    serializationStrategy: 'fullValue',
    target: { type: 'user_field__custom_field_options' },
  },
  {
    src: { field: 'default_custom_field_option', parentTypes: [USER_FIELD_TYPE_NAME] },
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
        'ticket_field__relationship_filter__all',
        'ticket_field__relationship_filter__any',
      ],
    },
    zendeskSerializationStrategy: 'ticketField',
    target: { type: TICKET_FIELD_TYPE_NAME },
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
    target: { type: TICKET_FIELD_TYPE_NAME },
    zendeskMissingRefStrategy: 'startsWith',
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
    target: { type: TICKET_FIELD_TYPE_NAME },
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
        'ticket_field__relationship_filter__all',
        'ticket_field__relationship_filter__any',
      ],
    },
    zendeskSerializationStrategy: 'orgField',
    target: { type: ORG_FIELD_TYPE_NAME },
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
    target: { type: ORG_FIELD_TYPE_NAME },
    zendeskMissingRefStrategy: 'startsWith',
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
    target: { type: USER_FIELD_TYPE_NAME },
  },
  {
    src: {
      field: 'field',
      parentTypes: [
        'ticket_field__relationship_filter__all',
        'ticket_field__relationship_filter__any',
      ],
    },
    zendeskSerializationStrategy: 'userFieldAlternative',
    target: { type: USER_FIELD_TYPE_NAME },
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
    target: { type: USER_FIELD_TYPE_NAME },
    zendeskMissingRefStrategy: 'startsWith',
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__columns'] },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__custom_fields'] },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'ticket_form_id' },
    serializationStrategy: 'id',
    target: { type: TICKET_FORM_TYPE_NAME },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: { field: 'ticket_form_ids' },
    serializationStrategy: 'id',
    target: { type: TICKET_FORM_TYPE_NAME },
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
    src: { field: 'default_locale', parentTypes: ['guide_settings'] },
    zendeskSerializationStrategy: 'locale',
    target: { type: 'guide_language_settings' },
  },
  {
    src: { field: 'source_locale', parentTypes: ['article', 'section', 'category'] },
    zendeskSerializationStrategy: 'locale',
    target: { type: 'guide_language_settings' },
  },
  {
    src: {
      field: 'locale',
      parentTypes: [
        'article', 'section', 'category',
        'section_translation', 'category_translation', 'article_translation',
      ],
    },
    zendeskSerializationStrategy: 'locale',
    target: { type: 'guide_language_settings' },
  },
  {
    src: { field: 'publish', parentTypes: ['permission_group'] },
    serializationStrategy: 'id',
    target: { type: 'user_segment' },
  },
  {
    src: { field: 'edit', parentTypes: ['permission_group'] },
    serializationStrategy: 'id',
    target: { type: 'user_segment' },
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
    src: { field: 'tags', parentTypes: ['user_segment'] },
    serializationStrategy: 'id',
    target: { type: 'tag' },
  },
  {
    src: { field: 'or_tags', parentTypes: ['user_segment'] },
    serializationStrategy: 'id',
    target: { type: 'tag' },
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'sort_by', parentTypes: ['view__execution'] },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['view__execution__group', 'view__execution__sort'] },
    serializationStrategy: 'id',
    target: { type: TICKET_FIELD_TYPE_NAME },
  },
  {
    src: { field: 'attachments', parentTypes: ['macro'] },
    serializationStrategy: 'id',
    target: { type: 'macro_attachment' },
  },
  {
    src: { field: 'tag', parentTypes: FIELD_TYPE_NAMES },
    serializationStrategy: 'id',
    target: { type: 'tag' },
  },
  {
    src: { field: 'parent_section_id', parentTypes: ['section'] },
    serializationStrategy: 'id',
    target: { type: 'section' },
  },
  {
    src: { field: PENDING_CATEGORY, parentTypes: [DEFAULT_CUSTOM_STATUSES_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: CUSTOM_STATUS_TYPE_NAME },
  },
  {
    src: { field: OPEN_CATEGORY, parentTypes: [DEFAULT_CUSTOM_STATUSES_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: CUSTOM_STATUS_TYPE_NAME },
  },
  {
    src: { field: HOLD_CATEGORY, parentTypes: [DEFAULT_CUSTOM_STATUSES_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: CUSTOM_STATUS_TYPE_NAME },
  },
  {
    src: { field: SOLVED_CATEGORY, parentTypes: [DEFAULT_CUSTOM_STATUSES_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: CUSTOM_STATUS_TYPE_NAME },
  },
  {
    src: {
      field: 'direct_parent_id',
      parentTypes: [
        'section',
      ],
    },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborParentType' },
  },
  {
    src: { field: 'installation_id', parentTypes: ['webhook__external_source__data'] },
    serializationStrategy: 'id',
    target: { type: 'app_installation' },
  },
]

const commonFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  // note: this overlaps with additional strategies, but because the first strategy
  // is chosen for serialization, it is safe
  {
    src: { field: 'value', parentTypes: ['workspace__conditions__all'] },
    zendeskSerializationStrategy: 'idString',
    target: { typeContext: 'neighborField' },
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
  {
    src: { field: 'value' },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborSubject' },
  },
  {
    src: {
      field: 'value',
      parentTypes: [
        'automation__actions',
        'automation__conditions__all',
        'automation__conditions__any',
        'macro__actions',
        'routing_attribute_value__conditions__all',
        'routing_attribute_value__conditions__any',
        'sla_policy__filter__all',
        'sla_policy__filter__any',
        'trigger__actions',
        'trigger__conditions__all',
        'trigger__conditions__any',
        'view__conditions__all',
        'view__conditions__any',
        'workspace__conditions__all',
        'workspace__conditions__any',
      ],
    },
    target: { typeContext: 'allowlistedNeighborField' },
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
    target: { typeContext: 'allowlistedNeighborSubject' },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
]

const secondIterationFieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  {
    src: {
      field: 'value',
      parentTypes: [
        'trigger__conditions__all',
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
        'ticket_field__relationship_filter__all',
        'ticket_field__relationship_filter__any',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
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
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: { field: 'group_ids', parentTypes: ['user_segment'] },
    serializationStrategy: 'id',
    target: { type: 'group' },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: {
      field: 'custom_statuses',
      parentTypes: ['ticket_form__agent_conditions__child_fields__required_on_statuses'],
    },
    serializationStrategy: 'id',
    target: { type: 'custom_status' },
    zendeskMissingRefStrategy: 'typeAndValue',
  },
  {
    src: {
      field: 'client_id',
      parentTypes: ['oauth_token'],
    },
    serializationStrategy: 'id',
    target: { type: 'oauth_global_client' },
  },
]

export const fieldNameToTypeMappingDefs: ZendeskFieldReferenceDefinition[] = [
  ...firstIterationFieldNameToTypeMappingDefs,
  ...secondIterationFieldNameToTypeMappingDefs,
  ...commonFieldNameToTypeMappingDefs,
]

export const lookupFunc = referenceUtils.generateLookupFunc(
  fieldNameToTypeMappingDefs,
  // This param is needed to resolve references by zendeskSerializationStrategy
  defs => new ZendeskFieldReferenceResolver(defs)
)

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const addReferences = async (refDefs: ZendeskFieldReferenceDefinition[]):
    Promise<void> => {
      const fixedDefs = refDefs
        .map(def => (
          config[FETCH_CONFIG].enableMissingReferences ? def : _.omit(def, 'zendeskMissingRefStrategy')
        ))
      await referenceUtils.addReferences({
        elements,
        defs: fixedDefs,
        fieldsToGroupBy: ['id', 'name', 'key', 'value', 'locale'],
        contextStrategyLookup,
        // since ids and references to ids vary inconsistently between string/number, allow both
        fieldReferenceResolverCreator: defs => new ZendeskFieldReferenceResolver(defs),
      })
    }
    await addReferences(
      [...firstIterationFieldNameToTypeMappingDefs, ...commonFieldNameToTypeMappingDefs]
    )
    await addReferences(secondIterationFieldNameToTypeMappingDefs)
  },

})
export default filter
