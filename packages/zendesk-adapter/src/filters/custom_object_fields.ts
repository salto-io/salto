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
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { references as referencesUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../constants'
import { FETCH_CONFIG } from '../config'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from './organization_field'

const { createMissingInstance } = referencesUtils

const LOOKUP_REGEX = /lookup:ticket\.ticket_field_(?<ticketFieldId>\d+).+\.(?<optionKey>[^.]+)$/
const CUSTOM_OBJECT_REGEX = /zen:custom_object:(?<customObjectKey>.+)/

const buildFieldTemplate = (ticketField: string | ReferenceExpression, option: string | ReferenceExpression)
  : TemplateExpression =>
  new TemplateExpression({
    parts: [
      'lookup:ticket.',
      ticketField,
      '.',
      option,
    ],
  })

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

const transformTriggerValue = (
  trigger: InstanceElement,
  ticketFieldsById: Record<string, InstanceElement>,
  customObjectsByKey: Record<string, InstanceElement>,
  enableMissingReferences: boolean
): void => {
  const conditions = (trigger.value.conditions?.all ?? [])
    .concat(trigger.value.conditions?.any ?? [])
  // const actions = trigger.value.actions ?? []

  conditions
    .filter(isRelevantCondition)
    .forEach((condition: CustomObjectCondition) => {
      // This is always false, used for type checking
      if (!_.isString(condition.field)) {
        return
      }
      const { ticketFieldId, optionKey } = condition.field.match(LOOKUP_REGEX)?.groups ?? {}
      const ticketField = ticketFieldsById[ticketFieldId]
      if (ticketField === undefined) {
        if (enableMissingReferences) {
          const missingTicket = createMissingInstance(ZENDESK, TICKET_FIELD_TYPE_NAME, ticketFieldId)
          condition.field = buildFieldTemplate(new ReferenceExpression(missingTicket.elemID), optionKey)
        }
      }
      const ticketFieldRef = new ReferenceExpression(ticketField.elemID, ticketField)

      const { customObjectKey } = ticketField.value.relationship_target_type?.match(CUSTOM_OBJECT_REGEX)?.groups ?? {}
      const customObject = customObjectsByKey[customObjectKey]
      if (customObjectKey === undefined || customObject === undefined) {
        if (enableMissingReferences) {
          const missingCustomObjectName = customObjectsByKey === undefined ? 'unknown' : customObjectKey
          const missingCustomObject = createMissingInstance(ZENDESK, CUSTOM_OBJECT_TYPE_NAME, missingCustomObjectName)
          condition.field = buildFieldTemplate(ticketFieldRef, new ReferenceExpression(missingCustomObject.elemID))
        }
        return
      }

      const customObjectFields = customObject.value.custom_object_fields ?? []
      const customObjectFieldRef = customObjectFields
        .filter(isResolvedReferenceExpression)
        .find((field: ReferenceExpression) => field.value.value.key === optionKey)

      if (customObjectFieldRef === undefined) {
        if (enableMissingReferences) {
          const missingCustomObjectFieldName = `${customObjectKey}__${optionKey}`
          const missingCustomObjectField = createMissingInstance(
            ZENDESK,
            CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
            missingCustomObjectFieldName
          )
          condition.field = buildFieldTemplate(ticketFieldRef, new ReferenceExpression(missingCustomObjectField.elemID))
        }
        return
      }

      condition.field = buildFieldTemplate(ticketFieldRef, customObjectFieldRef)

      if (condition.operator !== 'is' || condition.value === undefined) {
        return
      }
      // This is always false, used for type checkin
      if (!_.isString(condition.value)) {
        return
      }

      if (customObjectFieldRef.value.value.type === 'dropdown') {
        const fieldCustomOptions = customObjectFieldRef.value.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] ?? []
        const customOptionRef = fieldCustomOptions
          .filter(isResolvedReferenceExpression)
          .find((option: ReferenceExpression) => String(option.value.value.id) === condition.value)

        if (customOptionRef === undefined) {
          if (enableMissingReferences) {
            const missingCustomOption = createMissingInstance(
              ZENDESK,
              CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
              condition.value
            )
            condition.value = new ReferenceExpression(missingCustomOption.elemID)
          }
          return
        }
        condition.value = customOptionRef
      }

      // TODO - check field type, lookup - relationship_target_type
    })
}


/**
 *  Convert custom object field values to reference expressions
 */
const customObjectFieldsFilter: FilterCreator = ({ config }) => ({
  name: 'customObjectFieldOptionsFilter',
  onFetch: async (elements: Element[]) => {
    const enableMissingReferences = config[FETCH_CONFIG].enableMissingReferences ?? false

    const instances = elements.filter(isInstanceElement)
    const ticketFieldsById = _.keyBy<InstanceElement>(
      instances.filter(instance => instance.elemID.typeName === TICKET_FIELD_TYPE_NAME),
      instance => instance.value.id
    )

    const triggers = instances
      .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)

    const customObjectsByKey = _.keyBy<InstanceElement>(
      instances.filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME),
      instance => instance.value.key
    )

    triggers.forEach(
      trigger => transformTriggerValue(trigger, ticketFieldsById, customObjectsByKey, enableMissingReferences)
    )
  },
})


export default customObjectFieldsFilter
