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
import { Element, InstanceElement, ReferenceExpression, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'

const ZENDESK_TICKET_FIELD_TYPE = 'ticket_field'
const ZENDESK_USER_FIELD_TYPE = 'user_field'
const ZENDESK_ORGANIZATION_FIELD_TYPE = 'organization_field'
const ZENDESK_TICKET_FORM_TYPE = 'ticket_form'

export type ZendeskIndex = {
  elementsByInternalID: Record<string, Record<number, Readonly<InstanceElement>>>
  customFieldsByKey: Record<string, Record<string, Readonly<InstanceElement>>>
  standardTicketFieldByName: Record<string, Readonly<InstanceElement>>
  ticketCustomOptionByFieldIdAndValue: Record<number, Record<string, Readonly<InstanceElement>>>
  customOptionsByFieldKeyAndValue: Record<string, Record<string, Record<string, Readonly<InstanceElement>>>>
}
const indexElementsByInternalID = (
  elements: InstanceElement[],
): Record<number, Readonly<InstanceElement>> => _.keyBy(
  elements.filter(isInstanceElement).filter(e => !_.isNaN(Number(e.value.id))),
  e => Number(e.value.id),
)


const indexCustomOptionByFieldAndValue = (
  indexedFields: Record<string | number, Readonly<InstanceElement>>
): Record<string| number, Record<string, Readonly<InstanceElement>>> => {
  const mapFieldsToCustomOptions = (field: Readonly<InstanceElement>): Record<string, Readonly<InstanceElement>> => {
    const customOptionToValue = (option: Readonly<Element>): string | undefined => (
      (isInstanceElement(option) && option.value.value !== undefined && _.isString(option.value.value))
        ? option.value.value : undefined
    )

    const optionsRefList = field.value.custom_field_options

    const options = optionsRefList !== undefined
    && _.isArray(optionsRefList)
      ? optionsRefList.filter(isReferenceExpression).map(option => option.value)
      : []

    return _.keyBy(
      options,
      customOptionToValue,
    )
  }

  return _.mapValues(
    indexedFields,
    mapFieldsToCustomOptions,
  )
}

export const indexZendesk = (
  elements: ReadonlyArray<Readonly<Element>>
): ZendeskIndex => {
  const instances = elements.filter(isInstanceElement)
  const ticketFields = instances.filter(e => e.elemID.typeName === ZENDESK_TICKET_FIELD_TYPE)

  // User and organization custom fields parsed as field_<value.key>
  // whereas ticket custom field parsed as field_<ID>
  const indexCustomFieldsByKey = (objectField: string): Record<string, Readonly<InstanceElement>> => _.keyBy(
    instances.filter(e => e.elemID.typeName === objectField)
      .filter(isInstanceElement)
      .filter(e => e.value.key !== undefined),
    e => e.value.key as string,
  )

  const fieldsByKey = {
    user: indexCustomFieldsByKey(ZENDESK_USER_FIELD_TYPE),
    organization: indexCustomFieldsByKey(ZENDESK_ORGANIZATION_FIELD_TYPE),
  }

  const optionsByFieldKeyAndValue = {
    user: indexCustomOptionByFieldAndValue(fieldsByKey.user),
    organization: indexCustomOptionByFieldAndValue(fieldsByKey.organization),
  }

  const defaultTicketForm = instances.filter(e => e.elemID.typeName === ZENDESK_TICKET_FORM_TYPE)
    .find(e => e.value.default)

  // We search only within the defaultTicketForm.ticket_field_ids.
  // Otherwise, we might refer to a custom field with the same raw_name.
  const fieldNames: string[] = defaultTicketForm !== undefined
    && defaultTicketForm.value.ticket_field_ids !== undefined
    ? (defaultTicketForm.value.ticket_field_ids as Array<ReferenceExpression>)
      .map(e => e.elemID.name) : []

  const indexStandardTicketFieldByRawTitle = _.keyBy(
    ticketFields.filter(field => fieldNames.includes(field.elemID.name))
      .filter(isInstanceElement)
      .filter(e => e.value.raw_title !== undefined),
    e => e.value.raw_title.toLowerCase() as string,
  )

  const internalIdIndex = {
    macros: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === 'macro')),
    groups: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === 'group')),
    brands: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === 'brand')),
    ticketForms: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === 'ticket_form')),
    ticketFields: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === 'ticket_field')),
  }

  return {
    elementsByInternalID: internalIdIndex,
    standardTicketFieldByName: indexStandardTicketFieldByRawTitle,
    customFieldsByKey: fieldsByKey,
    ticketCustomOptionByFieldIdAndValue: indexCustomOptionByFieldAndValue(indexElementsByInternalID(ticketFields)),
    customOptionsByFieldKeyAndValue: optionsByFieldKeyAndValue,
  }
}
