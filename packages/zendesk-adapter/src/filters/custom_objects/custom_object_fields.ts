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
import {
  isInstanceElement,
  Element,
  InstanceElement,
  ReferenceExpression,
  Value,
  TemplateExpression,
  isReferenceExpression,
  Change,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
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
import { getIdByEmail, getUsers } from '../../user_utils'

const { makeArray } = collections.array
const { createMissingInstance } = referencesUtils
const { createPaginator } = clientUtils

const log = logger(module)

const USER_TYPE = 'user'

const relationTypeToType = (relationshipTargetType: Value): string => {
  if (!_.isString(relationshipTargetType)) {
    return 'unknown'
  }

  if (relationshipTargetType.startsWith('zen:custom_object')) {
    return CUSTOM_FIELD_OPTIONS_FIELD_NAME
  }
  switch (relationshipTargetType) {
    case 'zen:user':
      return USER_TYPE
    case 'zen:organization':
      return 'organization'
    case 'zen:ticket':
      return TICKET_FIELD_TYPE_NAME
    default:
      log.warn(`Unknown relationship target type: ${inspectValue(relationshipTargetType)}`)
      return 'unknown'
  }
}

type CustomObjectAction = {
  field: string
  // This will be string onFetch, but we need to define other types in order to set the value to them
  value: Array<string | TemplateExpression> | string | TemplateExpression
}

const isRelevantAction = (action: Value): action is CustomObjectAction =>
  _.isPlainObject(action) &&
  _.isString(action.field) &&
  // makeArray to catch both cases where value is a string or an array of strings
  makeArray(action.value).every(_.isString) &&
  LOOKUP_REGEX.test(makeArray(action.value)[0])

type CustomObjectCondition = {
  field: string | TemplateExpression
  operator: string
  value?: string | ReferenceExpression
  // eslint-disable-next-line camelcase
  is_user_value?: boolean
}

const isCondition = (value: Value): value is CustomObjectCondition =>
  _.isPlainObject(value) &&
  _.isString(value.field) &&
  _.isString(value.operator) &&
  (value.value === undefined || _.isString(value.value))

const isRelevantCondition = (condition: Value): boolean =>
  isCondition(condition) && _.isString(condition.field) && LOOKUP_REGEX.test(condition.field)

const isRelevantRelationshipFilter = (filter: Value): boolean =>
  isCondition(filter) && _.isString(filter.field) && RELATIONSHIP_FILTER_REGEX.test(filter.field)

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
  const isRuleValue =
    ['is', 'is_not'].includes(rule.operator) && ['dropdown', 'lookup'].includes(customObjectField.value.type)
  if (!isRuleValue) {
    return
  }

  const referencedElement = instancesById[rule.value] ?? usersById[rule.value]
  // lookup value type is based on the relationship_target_type of the custom object field
  const referencesElementType =
    customObjectField.value.type === 'lookup'
      ? relationTypeToType(customObjectField.value.relationship_target_type)
      : CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME

  // We need to mark values that contains user, so we can handle them differently during deploy
  if (referencesElementType === USER_TYPE) {
    rule.is_user_value = true
  }

  if (referencedElement === undefined) {
    if (enableMissingReferences) {
      if (referencesElementType === USER_TYPE) {
        // We don't want to create a missing user instance, because we have default have a fallback feature
        return
      }
      const missingInstance = createMissingInstance(ZENDESK, referencesElementType, rule.value.toString())
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
}: {
  trigger: InstanceElement
  instancesById: Record<string, InstanceElement>
  usersById: Record<string, string>
  customObjectsByKey: Record<string, InstanceElement>
  enableMissingReferences: boolean
}): void => {
  const transformArgs = { instancesById, customObjectsByKey, enableMissingReferences }
  const transformActionValue = (actions: Value[]): void => {
    actions.filter(isRelevantAction).forEach(action => {
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
    conditions.filter(isRelevantCondition).forEach(condition => {
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

  const actions =
    _.isArray(trigger.value.actions) && trigger.value.actions.every(action => _.isPlainObject(action))
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
}: {
  instance: InstanceElement
  instancesById: Record<string, InstanceElement>
  usersById: Record<string, string>
  customObjectsByKey: Record<string, InstanceElement>
  enableMissingReferences: boolean
}): void => {
  const relevantRelationshipFilters = [
    _.isArray(instance.value.relationship_filter?.all) ? instance.value.relationship_filter?.all : [],
    _.isArray(instance.value.relationship_filter?.any) ? instance.value.relationship_filter?.any : [],
  ]
    .flat()
    .filter(isRelevantRelationshipFilter)

  relevantRelationshipFilters.forEach((filter: CustomObjectCondition) => {
    if (!_.isString(filter.field)) {
      log.error(`relationship filter field is not a string - ${inspectValue(filter.field)}`)
      return
    }

    const { result, customObjectField } = transformRelationshipFilterField(
      filter.field,
      enableMissingReferences,
      customObjectsByKey,
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

const filterUserConditions = (
  conditions: Value,
  filterCondition: (condition: Value) => boolean,
): CustomObjectCondition[] => {
  const allConditions = _.isArray(conditions?.all) ? conditions?.all : []
  const anyConditions = _.isArray(conditions?.any) ? conditions?.any : []

  return allConditions
    .concat(anyConditions)
    .filter(filterCondition)
    .filter((condition: CustomObjectCondition) => condition.is_user_value)
}

// Returns all the custom object conditions that reference a user in the changes
// We don't return the condition's path because it is irrelevant, the same userId will be equal in different conditions
const getUserConditions = (changes: Change[]): CustomObjectCondition[] => {
  const instances = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange).map(getChangeData)

  const triggers = instances.filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
  const ticketFields = instances.filter(instance => instance.elemID.typeName === TICKET_FIELD_TYPE_NAME)
  const customObjectFields = instances.filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)

  const triggerUserConditions = triggers.flatMap(trigger =>
    filterUserConditions(trigger.value.conditions, isRelevantCondition),
  )

  const ticketAndCustomObjectFieldUserFilters = ticketFields
    .concat(customObjectFields)
    .flatMap(field => filterUserConditions(field.value.relationship_filter, isRelevantRelationshipFilter))

  return triggerUserConditions.concat(ticketAndCustomObjectFieldUserFilters)
}

/**
 *  Convert custom object field values to reference expressions
 *  preDeploy handles values that are users, including fallback user
 *  onDeploy reverts the preDeploy
 */
const customObjectFieldsFilter: FilterCreator = ({ config, client }) => {
  const userPathToOriginalValue: Record<string, string> = {}
  const paginator = createPaginator({
    client,
    paginationFuncCreator: paginate,
  })
  return {
    name: 'customObjectFieldOptionsFilter',
    onFetch: async (elements: Element[]) => {
      const enableMissingReferences = config[FETCH_CONFIG].enableMissingReferences ?? false

      const instances = elements.filter(isInstanceElement)

      // It is possible to key all instance by id because the internal Id is unique across all types (SALTO-4805)
      const usersById = await getIdByEmail(paginator, config[FETCH_CONFIG].resolveUserIDs)
      const instancesById = _.keyBy(
        instances.filter(instance => _.isNumber(instance.value.id)),
        instance => _.parseInt(instance.value.id),
      )

      const customObjectsByKey = _.keyBy(
        instances
          .filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME)
          .filter(instance => _.isString(instance.value.key)),
        instance => String(instance.value.key),
      )

      const triggers = instances.filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
      const ticketFields = instances.filter(instance => instance.elemID.typeName === TICKET_FIELD_TYPE_NAME)
      const customObjectFields = instances.filter(inst => inst.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)

      triggers.forEach(trigger =>
        transformTriggerValue({
          trigger,
          customObjectsByKey,
          enableMissingReferences,
          instancesById,
          usersById,
        }),
      )
      ticketFields.concat(customObjectFields).forEach(instance =>
        transformTicketAndCustomObjectFieldValue({
          instance,
          customObjectsByKey,
          enableMissingReferences,
          instancesById,
          usersById,
        }),
      )
    },
    // Knowing if a value is a user depends on the custom_object_field attached to its condition's field
    // For that reason we need to specifically handle it here, using 'is_user_value' field that we added in onFetch
    // non-user references are handled by handle_template_expressions.ts
    preDeploy: async changes => {
      const userConditions = getUserConditions(changes)
      if (userConditions.length === 0) {
        return
      }
      const { users } = await getUsers(paginator, config[FETCH_CONFIG].resolveUserIDs)
      const usersByEmail = _.keyBy(users, user => user.email)

      const missingUserConditions: CustomObjectCondition[] = []
      userConditions.forEach(condition => {
        if (_.isString(condition.value) && usersByEmail[condition.value]) {
          const userId = usersByEmail[condition.value].id.toString()
          userPathToOriginalValue[userId] = condition.value
          condition.value = userId
        } else {
          missingUserConditions.push(condition)
        }
      })
    },
    onDeploy: async changes => {
      getUserConditions(changes).forEach(condition => {
        condition.value =
          _.isString(condition.value) && userPathToOriginalValue[condition.value] !== undefined
            ? userPathToOriginalValue[condition.value]
            : condition.value
      })
    },
  }
}

export default customObjectFieldsFilter
