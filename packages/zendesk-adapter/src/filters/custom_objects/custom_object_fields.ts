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
  ReferenceExpression, Value, TemplateExpression, isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { references as referencesUtils, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
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
  transformRelationshipFilterField,
} from './utils'
import { paginate } from '../../client/pagination'
import { getIdByEmail } from '../../user_utils'

const { makeArray } = collections.array
const { createMissingInstance } = referencesUtils
const { createPaginator } = clientUtils
const log = logger(module)

const relationTypeToType = (relationshipTargetType: Value): string => {
  if (!_.isString(relationshipTargetType)) {
    return 'unknown'
  }

  if (relationshipTargetType.startsWith('zen:custom_object')) {
    return CUSTOM_FIELD_OPTIONS_FIELD_NAME
  }
  switch (relationshipTargetType) {
    case 'zen:user':
      return 'user'
    case 'zen:organization':
      return 'organization'
    case 'zen:ticket':
      return TICKET_FIELD_TYPE_NAME
    default:
      log.warn(`Unknown relationship target type: ${inspectValue(relationshipTargetType)}`)
      return 'unknown'
  }
}

type Rule = {
  field: string | TemplateExpression
  operator: string
  value?: string | ReferenceExpression
}

const isRelevantRule = (rule: Value): rule is Rule =>
  _.isPlainObject(rule)
  && _.isString(rule.operator)
  && (rule.value === undefined || _.isString(rule.value))
  && RELATIONSHIP_FILTER_REGEX.test(rule.field)

type CustomObjectAction = {
  field: string
  // This will be string onFetch, but we need to define other types in order to set the value to them
  value: Array<string | TemplateExpression> | string | TemplateExpression
}

const isRelevantAction = (action: Value): action is CustomObjectAction =>
  _.isPlainObject(action)
  && _.isString(action.field)
  // makeArray to catch both cases where value is a string or an array of strings
  && makeArray(action.value).every(_.isString)
  && LOOKUP_REGEX.test(makeArray(action.value)[0])

type CustomObjectCondition = {
  field: string | TemplateExpression
  operator: string
  value?: string | ReferenceExpression
}

const isRelevantCondition = (condition: Value): condition is CustomObjectCondition =>
  _.isPlainObject(condition)
  && _.isString(condition.field)
  && _.isString(condition.operator)
  && LOOKUP_REGEX.test(condition.field)


// Conditions and filters (we will call them rules) may also have a reference in their value field
const transformRuleValue = ({
  customObjectField,
  rule,
  enableMissingReferences,
  instancesById,
  usersById,
}: {
  customObjectField?: InstanceElement
  rule: CustomObjectCondition
  enableMissingReferences: boolean
  instancesById: Record<string, InstanceElement>
  usersById: Record<string, string>
}): void => {
  // Make sure the CustomObjectField wasn't missing, and type checks
  if (customObjectField === undefined || rule.value === undefined || isReferenceExpression(rule.value)) {
    return
  }
  // These are special cases where the value is a reference to an element
  const isRuleValue = ['is', 'is_not'].includes(rule.operator) && ['dropdown', 'lookup'].includes(customObjectField.value.type)
  if (!isRuleValue) {
    return
  }

  const referencedElement = instancesById[rule.value] ?? usersById[rule.value]

  if (referencedElement === undefined) {
    if (enableMissingReferences) {
      const missingType = customObjectField.value.type === 'lookup'
        // lookup value type is based on the relationship_target_type of the custom object field
        ? relationTypeToType(customObjectField.value.relationship_target_type)
        : CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME
      const missingInstance = createMissingInstance(
        ZENDESK,
        missingType,
        rule.value.toString(),
      )
      rule.value = new ReferenceExpression(missingInstance.elemID, missingInstance)
    }
    return
  }

  rule.value = _.isString(referencedElement)
    ? referencedElement // This is a user
    : new ReferenceExpression(referencedElement.elemID, referencedElement) // This is anything else
}

const transformTriggerValue = ({
  trigger,
  instancesById,
  usersById,
  customObjectsByKey,
  enableMissingReferences,
}:
{
  trigger: InstanceElement
  instancesById: Record<string, InstanceElement>
  usersById: Record<string, string>
  customObjectsByKey: Record<string, InstanceElement>
  enableMissingReferences: boolean
}): void => {
  const transformArgs = { instancesById, customObjectsByKey, enableMissingReferences }
  const transformActionValue = (actions: Value[]): void => {
    actions
      .filter(isRelevantAction)
      .forEach(action => {
        const value = makeArray(action.value)[0]
        // always false, used for type casting
        if (!_.isString(value)) {
          log.error(`action value is not a string - ${inspectValue(value)}`)
          return
        }
        const { result } = transformCustomObjectLookupField({ field: value, ...transformArgs })
        // notification_user is a special case, value is an array and the first element is the custom_object field
        if (action.field === 'notification_user' && _.isArray(action.value)) {
          action.value[0] = result
        } else {
          action.value = result
        }
      })
  }
  const transformConditionValue = (conditions: Value[]): void => {
    conditions
      .filter(isRelevantCondition)
      .forEach(condition => {
        // always false, used for type casting
        if (!_.isString(condition.field)) {
          log.error(`condition field is not a string - ${inspectValue(condition.field)}`)
          return
        }
        const { result, ticketField, customObjectField } = transformCustomObjectLookupField({
          field: condition.field,
          ...transformArgs,
        })
        condition.field = result

        if (ticketField !== undefined) {
          transformRuleValue({
            customObjectField,
            rule: condition,
            enableMissingReferences,
            instancesById,
            usersById,
          })
        }
      })
  }

  const actions = _.isArray(trigger.value.actions) && trigger.value.actions.every(action => _.isPlainObject(action))
    ? trigger.value.actions
    : []
  transformActionValue(actions)

  const conditions = [
    _.isArray(trigger.value.conditions?.all) ? trigger.value.conditions?.all : [],
    _.isArray(trigger.value.conditions?.any) ? trigger.value.conditions?.any : [],
  ].flat()
  transformConditionValue(conditions)
}

const transformTicketAndCustomObjectFieldValue = ({
  instance,
  instancesById,
  usersById,
  customObjectsByKey,
  enableMissingReferences,
}:
{
  instance: InstanceElement
  instancesById: Record<string, InstanceElement>
  usersById: Record<string, string>
  customObjectsByKey: Record<string, InstanceElement>
  enableMissingReferences: boolean
}): void => {
  const relevantRelationshipFilters = [
    _.isArray(instance.value.relationship_filter?.all) ? instance.value.relationship_filter?.all : [],
    _.isArray(instance.value.relationship_filter?.any) ? instance.value.relationship_filter?.any : [],
  ].flat().filter(isRelevantRule)

  relevantRelationshipFilters.forEach((filter: Rule) => {
    if (!_.isString(filter.field)) {
      log.error(`relationship filter field is not a string - ${inspectValue(filter.field)}`)
      return
    }

    const { result, customObjectField } = transformRelationshipFilterField(
      filter.field, enableMissingReferences, customObjectsByKey
    )
    filter.field = result

    transformRuleValue({
      customObjectField,
      rule: filter,
      enableMissingReferences,
      instancesById,
      usersById,
    })
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

    // It is possible to key all instance by id because the internal Id is unique across all types (SALTO-4805)
    const usersById = await getIdByEmail(paginator)
    const instancesById = _.keyBy(
      instances.filter(instance => _.isNumber(instance.value.id)),
      instance => _.parseInt(instance.value.id)
    )

    const customObjectsByKey = _.keyBy(
      instances
        .filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME)
        .filter(instance => _.isString(instance.value.key)),
      instance => String(instance.value.key)
    )

    const triggers = instances.filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
    const ticketFields = instances.filter(instance => instance.elemID.typeName === TICKET_FIELD_TYPE_NAME)
    const customObjectFields = instances.filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)

    triggers.forEach(
      trigger => transformTriggerValue({
        trigger,
        customObjectsByKey,
        enableMissingReferences,
        instancesById,
        usersById,
      })
    )
    ticketFields.concat(customObjectFields).forEach(
      instance => transformTicketAndCustomObjectFieldValue({
        instance,
        customObjectsByKey,
        enableMissingReferences,
        instancesById,
        usersById,
      })
    )
  },
})


export default customObjectFieldsFilter
