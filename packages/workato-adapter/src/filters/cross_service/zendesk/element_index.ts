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
import { Element, InstanceElement, isInstanceElement, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'

export type ZendeskIndex = {
  elementByID: Record<number, Readonly<InstanceElement>>
  userCustomFieldByKey: Record<string, Readonly<InstanceElement>>
  organizationCustomFieldByKey: Record<string, Readonly<InstanceElement>>
  standardTicketFieldByName: Record<string, Readonly<InstanceElement>>
  ticketCustomOptionByFieldIdAndValue: Record<number, Record<string, Readonly<InstanceElement>>>
  userCustomOptionByFieldKeyAndValue: Record<string, Record<string, Readonly<InstanceElement>>>
  organizationCustomOptionByFieldKeyAndValue: Record<string, Record<string, Readonly<InstanceElement>>>
}

export const indexZendesk = (
  elements: ReadonlyArray<Readonly<Element>>
): ZendeskIndex => {
  const instances = elements.filter(isInstanceElement)

  const indexElementsByID = (
    elems: InstanceElement[],
  ): Record<number, Readonly<InstanceElement>> => {
    const toId = (element: Readonly<Element>): number | undefined => (
      isInstanceElement(element) ? element.value.id : undefined
    )

    return _.keyBy(
      elems.filter(e => toId(e) !== undefined),
      e => toId(e) as number,
    )
  }

  // User and organization custom fields parsed as field_<value.key>
  // whereas ticket custom field parsed as field_<ID>
  const indexCustomFieldsByKey = (objectField: 'user_field' | 'organization_field'): Record<string, Readonly<InstanceElement>> => {
    const toKey = (element: Readonly<Element>): string | undefined => (
      isInstanceElement(element) ? element.value.key : undefined
    )

    return _.keyBy(
      instances.filter(e => e.elemID.typeName === objectField).filter(e => toKey(e) !== undefined),
      e => toKey(e) as string,
    )
  }

  const indexStandardTicketFieldByRawTitle = (): Record<string, Readonly<InstanceElement>> => {
    const toRawTitle = (element: Readonly<Element>): string | undefined => {
      if (isInstanceElement(element) && element.value.raw_title !== undefined) {
        return element.value.raw_title.toLowerCase()
      }
      return undefined
    }

    // We only search within the defaultTicketForm.ticket_field_ids.
    // Otherwise, we might refer to a custom field with the same raw_name.
    const defaultTicketForm = instances.filter(e => e.elemID.typeName === 'ticket_form')
      .find(e => e.value.default)

    // TODO - change to schema guard after I ask Alon about the default option
    const fields: InstanceElement[] = defaultTicketForm !== undefined
      && defaultTicketForm.value.ticket_field_ids !== undefined
      ? (defaultTicketForm.value.ticket_field_ids as Array<ReferenceExpression>)
        .map(e => e.value) : []

    return _.keyBy(
      fields.filter(e => toRawTitle(e) !== undefined),
      e => toRawTitle(e) as string,
    )
  }

  const indexCustomOptionByFieldAndValue = (
    indexedFields: Record<string | number, Readonly<InstanceElement>>
  ): Record<string| number, Record<string, Readonly<InstanceElement>>> => {
    const mapFieldsToCustomOptions = (field: Readonly<InstanceElement>): Record<string, Readonly<InstanceElement>> => {
      const customOptionToValue = (option: Readonly<Element>): string | undefined => {
        return (isInstanceElement(option) && option.value.value !== undefined)
          ? option.value.value : undefined
      }

      const optionsRefList = field.value.custom_field_options

      const options = optionsRefList !== undefined
      && _.isArray(optionsRefList)
        ? optionsRefList.map(option => (isReferenceExpression(option) ? option.value : undefined))
          .filter(option => option !== undefined)
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

  const ticketFields = instances.filter(e => e.elemID.typeName === 'ticket_field')
  const userFieldByKey = indexCustomFieldsByKey('user_field')
  const organizationFieldByKey = indexCustomFieldsByKey('organization_field')

  return {
    elementByID: indexElementsByID(instances),
    standardTicketFieldByName: indexStandardTicketFieldByRawTitle(),
    userCustomFieldByKey: userFieldByKey,
    organizationCustomFieldByKey: organizationFieldByKey,
    ticketCustomOptionByFieldIdAndValue: indexCustomOptionByFieldAndValue(indexElementsByID(ticketFields)),
    userCustomOptionByFieldKeyAndValue: indexCustomOptionByFieldAndValue(userFieldByKey),
    organizationCustomOptionByFieldKeyAndValue: indexCustomOptionByFieldAndValue(organizationFieldByKey),
  }
}
