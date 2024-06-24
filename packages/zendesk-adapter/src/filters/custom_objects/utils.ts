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
import { InstanceElement, isReferenceExpression, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { compactTemplate, createTemplateExpression, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { references as referencesUtils } from '@salto-io/adapter-components'
import {
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../constants'

const { createMissingInstance } = referencesUtils

// 'custom_object.<objectKey>.custom_fields.<fieldKey>'
export const RELATIONSHIP_FILTER_REGEX = /custom_object\.(?<customObjectKey>.+)\.custom_fields\.(?<fieldKey>.+)$/
// lookup:ticket.ticket_field_<123>.custom_fields.<optionKey>
export const LOOKUP_REGEX = /lookup:ticket\.ticket_field_(?<ticketFieldId>\d+)\.custom_fields\.(?<optionKey>[^.]+)$/
// zen:custom_object:objectKey
const CUSTOM_OBJECT_REGEX = /zen:custom_object:(?<customObjectKey>.+)/

type MissingTemplateArgs = {
  ticketField: string | ReferenceExpression
  customKey: string
  missingInstanceName: string
  missingInstanceType: string
}

export const createMissingTemplate = ({
  ticketField,
  customKey,
  missingInstanceName,
  missingInstanceType,
  enableMissingReferences,
  buildTemplateFunc,
}: MissingTemplateArgs & {
  enableMissingReferences: boolean
  buildTemplateFunc: (
    firstInstance: string | ReferenceExpression,
    secondInstance: string | ReferenceExpression,
  ) => TemplateExpression
}): TemplateExpression | string => {
  if (!enableMissingReferences) {
    return compactTemplate(buildTemplateFunc(ticketField, customKey))
  }
  const missingInstance = createMissingInstance(ZENDESK, missingInstanceType, missingInstanceName)
  const missingInstanceRef = new ReferenceExpression(missingInstance.elemID, missingInstance)
  return isReferenceExpression(ticketField)
    ? compactTemplate(buildTemplateFunc(ticketField, missingInstanceRef))
    : compactTemplate(buildTemplateFunc(missingInstanceRef, customKey))
}

type TransformResult = {
  result: string | TemplateExpression
  ticketField?: InstanceElement
  customObjectField?: InstanceElement
}

const buildFieldTemplate = (
  ticketField: string | ReferenceExpression,
  option: string | ReferenceExpression,
): TemplateExpression =>
  createTemplateExpression({
    parts: ['lookup:ticket.ticket_field_', ticketField, '.custom_fields.', option],
  })

/**
 * Transforms a 'lookup' value to template expressions
 * lookup values are strings that starts with 'lookup' and contains a ticket_field id and a custom_object_field key
 * The custom_object_field is not a direct reference, so we need to find it smartly
 * ticket_field is related to a custom_object, custom_object has fields, one of them has the matching key
 */
export const transformCustomObjectLookupField = ({
  field,
  instancesById,
  customObjectsByKey,
  enableMissingReferences,
}: {
  field: string
  instancesById: Record<string, InstanceElement>
  customObjectsByKey: Record<string, InstanceElement>
  enableMissingReferences: boolean
}): TransformResult => {
  const createMissingRefTemplate = (args: MissingTemplateArgs): TemplateExpression | string =>
    createMissingTemplate({
      ...args,
      enableMissingReferences,
      buildTemplateFunc: buildFieldTemplate,
    })

  // Lookup of the ticket field
  const { ticketFieldId, optionKey } = field.match(LOOKUP_REGEX)?.groups ?? {}
  const ticketField = instancesById[ticketFieldId]
  if (ticketField === undefined) {
    return {
      result: createMissingRefTemplate({
        ticketField: ticketFieldId,
        customKey: optionKey,
        missingInstanceName: ticketFieldId,
        missingInstanceType: TICKET_FIELD_TYPE_NAME,
      }),
    }
  }
  const ticketFieldRef = new ReferenceExpression(ticketField.elemID, ticketField)

  // Lookup of the custom_object related to the ticket field
  const { customObjectKey } = ticketField.value.relationship_target_type?.match(CUSTOM_OBJECT_REGEX)?.groups ?? {}
  const customObject = customObjectsByKey[customObjectKey]
  if (customObjectKey === undefined || customObject === undefined) {
    return {
      result: createMissingRefTemplate({
        ticketField: ticketFieldRef,
        customKey: optionKey,
        missingInstanceName: customObjectsByKey === undefined ? 'unknown' : customObjectKey,
        missingInstanceType: CUSTOM_OBJECT_TYPE_NAME,
      }),
    }
  }

  // Lookup of the relevant custom_object_field of the custom_object
  const customObjectFields = customObject.value.custom_object_fields ?? []
  const customObjectFieldRef = customObjectFields
    .filter(isResolvedReferenceExpression)
    .find((customField: ReferenceExpression) => customField.value.value.key === optionKey)

  if (customObjectFieldRef === undefined) {
    return {
      result: createMissingRefTemplate({
        ticketField: ticketFieldRef,
        customKey: optionKey,
        missingInstanceName: `${customObjectKey}__${optionKey}`,
        missingInstanceType: CUSTOM_OBJECT_FIELD_TYPE_NAME,
      }),
      ticketField,
    }
  }

  return {
    result: buildFieldTemplate(ticketFieldRef, customObjectFieldRef),
    ticketField,
    customObjectField: customObjectFieldRef.value,
  }
}

const buildFilterTemplate = (
  customObject: string | ReferenceExpression,
  field: string | ReferenceExpression,
): TemplateExpression =>
  createTemplateExpression({
    parts: ['custom_object.', customObject, '.custom_fields.', field],
  })

export const transformRelationshipFilterField = (
  field: string,
  enableMissingReferences: boolean,
  customObjectsByKey: Record<string, InstanceElement>,
): TransformResult => {
  const createMissingRefTemplate = (args: MissingTemplateArgs): TemplateExpression | string =>
    createMissingTemplate({
      ...args,
      enableMissingReferences,
      buildTemplateFunc: buildFilterTemplate,
    })
  const { customObjectKey, fieldKey } = field.match(RELATIONSHIP_FILTER_REGEX)?.groups ?? {}

  // Lookup of the custom_object
  const customObject = customObjectsByKey[customObjectKey]
  if (customObject === undefined) {
    return {
      result: createMissingRefTemplate({
        ticketField: customObjectKey,
        customKey: fieldKey,
        missingInstanceName: customObjectKey,
        missingInstanceType: CUSTOM_OBJECT_TYPE_NAME,
      }),
    }
  }

  const customObjectRef = new ReferenceExpression(customObject.elemID, customObject)

  // Lookup of the relevant custom_object_field of the custom_object
  const customObjectFieldRef = (customObject.value.custom_object_fields ?? [])
    .filter(isResolvedReferenceExpression)
    .find((customField: ReferenceExpression) => customField.value.value.key === fieldKey)
  if (customObjectFieldRef === undefined) {
    return {
      result: createMissingRefTemplate({
        ticketField: customObjectRef,
        customKey: fieldKey,
        missingInstanceName: fieldKey,
        missingInstanceType: CUSTOM_OBJECT_FIELD_TYPE_NAME,
      }),
    }
  }

  return {
    result: buildFilterTemplate(customObjectRef, customObjectFieldRef),
    customObjectField: customObjectFieldRef.value,
  }
}
