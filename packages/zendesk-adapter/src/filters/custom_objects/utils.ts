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
import { InstanceElement, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { references as referencesUtils } from '@salto-io/adapter-components'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../constants'

const { createMissingInstance } = referencesUtils

export const LOOKUP_REGEX = /lookup:ticket\.ticket_field_(?<ticketFieldId>\d+).+\.(?<optionKey>[^.]+)$/
const CUSTOM_OBJECT_REGEX = /zen:custom_object:(?<customObjectKey>.+)/

const buildFieldTemplate = (ticketField: string | ReferenceExpression, option: string | ReferenceExpression)
  : TemplateExpression =>
  new TemplateExpression({
    parts: [
      'lookup:',
      ticketField,
      '.',
      option,
    ],
  })


export type TransformResult = {
  result: string | TemplateExpression
  ticketField?: InstanceElement
  customObjectField?: InstanceElement
}
export const transformCustomObjectField = (
  field: string,
  ticketFieldsById: Record<string, InstanceElement>,
  customObjectsByKey: Record<string, InstanceElement>,
  enableMissingReferences: boolean
): TransformResult => {
  const { ticketFieldId, optionKey } = field.match(LOOKUP_REGEX)?.groups ?? {}
  const ticketField = ticketFieldsById[ticketFieldId]
  if (ticketField === undefined) {
    if (enableMissingReferences) {
      const missingTicket = createMissingInstance(ZENDESK, TICKET_FIELD_TYPE_NAME, ticketFieldId)
      return {
        result: buildFieldTemplate(new ReferenceExpression(missingTicket.elemID), optionKey),
      }
    }
    return { result: field }
  }
  const ticketFieldRef = new ReferenceExpression(ticketField.elemID, ticketField)

  const { customObjectKey } = ticketField.value.relationship_target_type?.match(CUSTOM_OBJECT_REGEX)?.groups ?? {}
  const customObject = customObjectsByKey[customObjectKey]
  if (customObjectKey === undefined || customObject === undefined) {
    if (enableMissingReferences) {
      const missingCustomObjectName = customObjectsByKey === undefined ? 'unknown' : customObjectKey
      const missingCustomObject = createMissingInstance(ZENDESK, CUSTOM_OBJECT_TYPE_NAME, missingCustomObjectName)
      return {
        result: buildFieldTemplate(ticketFieldRef, new ReferenceExpression(missingCustomObject.elemID)),
        ticketField,
      }
    }
    return {
      result: buildFieldTemplate(ticketFieldRef, optionKey),
      ticketField,
    }
  }

  const customObjectFields = customObject.value.custom_object_fields ?? []
  const customObjectFieldRef = customObjectFields
    .filter(isResolvedReferenceExpression)
    .find((customField: ReferenceExpression) => customField.value.value.key === optionKey)

  if (customObjectFieldRef === undefined) {
    if (enableMissingReferences) {
      const missingCustomObjectFieldName = `${customObjectKey}__${optionKey}`
      const missingCustomObjectField = createMissingInstance(
        ZENDESK,
        CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
        missingCustomObjectFieldName
      )
      return {
        result: buildFieldTemplate(ticketFieldRef, new ReferenceExpression(missingCustomObjectField.elemID)),
        ticketField,
      }
    }
    return {
      result: buildFieldTemplate(ticketFieldRef, optionKey),
      ticketField,
    }
  }

  return {
    result: buildFieldTemplate(ticketFieldRef, customObjectFieldRef),
    ticketField,
    customObjectField: customObjectFieldRef.value,
  }
}
