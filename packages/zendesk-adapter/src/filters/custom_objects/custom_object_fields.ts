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
import {
  isInstanceElement,
  Element,
  InstanceElement,
  ReferenceExpression, Value, TemplateExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { references as referencesUtils, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../constants'
import { FETCH_CONFIG } from '../../config'
import {
  LOOKUP_REGEX,
  RELATIONSHIP_FILTER_REGEX,
  transformCustomObjectLookupField,
  transformFilterField,
  TransformResult,
} from './utils'
import { paginate } from '../../client/pagination'
import { getIdByEmail } from '../../user_utils'

const { makeArray } = collections.array
const { createMissingInstance } = referencesUtils
const { createPaginator } = clientUtils

type CustomObjectCondition = {
  field: string | TemplateExpression
  operator: string
  value?: string | ReferenceExpression
}

const relationTypeToType = (relationshipTargetType: Value): string => {
  if (!_.isString(relationshipTargetType)) {
    return 'unknown'
  }
  switch (relationshipTargetType) {
    case 'zen:user':
      return 'user'
    case 'zen:organization':
      return 'organization'
    case 'zen:ticket':
      return TICKET_FIELD_TYPE_NAME
    // case 'zen:custom_object':
    // return CUSTOM_OBJECT_TYPE_NAME // TODO Seroussi - is this possible? if so - is it by id or by key?
    default:
      return 'unknown'
  }
}

const isCustomFieldValue = (value: Value): boolean => _.isString(value) && LOOKUP_REGEX.test(value)

const isRelevantFilter = (filter: Value): filter is { field: string } =>
  _.isPlainObject(filter) && RELATIONSHIP_FILTER_REGEX.test(filter.field)

const isRelevantCondition = (condition: Value): condition is CustomObjectCondition =>
  _.isPlainObject(condition)
  && _.isString(condition.field)
  && _.isString(condition.operator)
  && LOOKUP_REGEX.test(condition.field)

const transformTriggerValue = (
  trigger: InstanceElement,
  instancesById: Record<string, InstanceElement>,
  usersById: Record<string, string>,
  customObjectsByKey: Record<string, InstanceElement>,
  enableMissingReferences: boolean
): void => {
  const transformField = (value: string): TransformResult => transformCustomObjectLookupField(
    value,
    instancesById,
    customObjectsByKey,
    enableMissingReferences
  )
  const conditions = (_.isArray(trigger.value.conditions?.all) ? trigger.value.conditions?.all : [])
    .concat(_.isArray(trigger.value.conditions?.any) ? trigger.value.conditions?.any : [])
  const actions = _.isArray(trigger.value.actions) ? trigger.value.actions : []

  actions
    .filter(action => isCustomFieldValue(makeArray(action.value)[0]))
    .forEach(action => {
      if (_.isArray(action.value)) {
        action.value[0] = transformField(action.value[0]).result
      } else {
        action.value = transformField(action.value).result
      }
    })

  conditions
    .filter(isRelevantCondition)
    .filter((condition: CustomObjectCondition) => isCustomFieldValue(condition.field))
    .forEach((condition: CustomObjectCondition) => {
      if (!_.isString(condition.field)) {
        return
      }
      const { result, ticketField, customObjectField } = transformField(condition.field)

      condition.field = result

      if (
        condition.operator !== 'is'
        || !_.isString(condition.value)
        || ticketField === undefined
        || customObjectField === undefined
      ) {
        return
      }

      if (['dropdown', 'lookup'].includes(customObjectField.value.type)) {
        const referencesElement = instancesById[condition.value] ?? usersById[condition.value]
        if (referencesElement === undefined) {
          if (enableMissingReferences) {
            const missingType = customObjectField.value.type === 'dropdown'
              ? CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME
              : relationTypeToType(customObjectField.value.relationship_target_type)
            const missingCustomOption = createMissingInstance(
              ZENDESK,
              missingType,
              condition.value
            )
            condition.value = new ReferenceExpression(missingCustomOption.elemID)
          }
          return
        }
        condition.value = _.isString(referencesElement)
          ? referencesElement
          : new ReferenceExpression(referencesElement.elemID, referencesElement)
      }
    })
}

const transformTicketFieldValue = (
  ticketField: InstanceElement,
  customObjectsByKey: Record<string, InstanceElement>,
  enableMissingReferences: boolean
): void => {
  const relevantRelationShipFilters = (ticketField.value.relationship_filter?.all ?? [])
    .concat(ticketField.value.relationship_filter?.any ?? [])
    .filter(isRelevantFilter)

  relevantRelationShipFilters.forEach((filter: { field: string | TemplateExpression }) => {
    if (!_.isString(filter.field)) {
      return
    }
    filter.field = transformFilterField(filter.field, enableMissingReferences, customObjectsByKey)
  })
}
/**
 *  Convert custom object field values to reference expressions
 */
const customObjectFieldsFilter: FilterCreator = ({ config, client }) => ({
  name: 'customObjectFieldOptionsFilter',
  onFetch: async (elements: Element[]) => {
    const enableMissingReferences = config[FETCH_CONFIG].enableMissingReferences ?? false


    const instances = elements.filter(isInstanceElement)

    const paginator = createPaginator({
      client,
      paginationFuncCreator: paginate,
    })

    // This is possible because according to Zendesk, the internal Id is unique across all types (SALTO-4805)
    const usersById = await getIdByEmail(paginator)
    const instancesById = _.keyBy<InstanceElement>(
      instances.filter(instance => instance.value.id !== undefined),
      instance => instance.value.id
    )


    const triggers = instances
      .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
    const ticketFields = instances
      .filter(instance => instance.elemID.typeName === TICKET_FIELD_TYPE_NAME)

    const customObjectsByKey = _.keyBy<InstanceElement>(
      instances.filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME),
      instance => instance.value.key
    )

    triggers.forEach(
      trigger => transformTriggerValue(trigger, instancesById, usersById, customObjectsByKey, enableMissingReferences)
    )
    ticketFields.forEach(
      ticketField => transformTicketFieldValue(ticketField, customObjectsByKey, enableMissingReferences)
    )
  },
})


export default customObjectFieldsFilter
