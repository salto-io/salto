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
import { FilterCreator } from '../../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../constants'
import { FETCH_CONFIG } from '../../config'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../organization_field'
import { LOOKUP_REGEX, transformCustomObjectField, TransformResult } from './utils'

const { createMissingInstance } = referencesUtils

type CustomObjectCondition = {
  field: string | TemplateExpression
  operator: string
  value?: string | ReferenceExpression
}

const isCustomFieldValue = (value: Value): boolean => _.isString(value) && LOOKUP_REGEX.test(value)

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
  const transformField = (value: string): TransformResult => transformCustomObjectField(
    value,
    ticketFieldsById,
    customObjectsByKey,
    enableMissingReferences
  )
  const conditions = (_.isArray(trigger.value.conditions?.all) ? trigger.value.conditions?.all : [])
    .concat(_.isArray(trigger.value.conditions?.any) ? trigger.value.conditions?.any : [])
  const actions = _.isArray(trigger.value.actions) ? trigger.value.actions : []

  actions
    .filter(action => isCustomFieldValue(action.value))
    .forEach(action => { action.value = transformField(action.value).result })

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

      if (customObjectField.value.type === 'dropdown') {
        const fieldCustomOptions = customObjectField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] ?? []
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
