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

import Joi from 'joi'
import {
  Element,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'

const ZENDESK_TICKET_FIELD_TYPE = 'ticket_field'
const ZENDESK_USER_FIELD_TYPE = 'user_field'
const ZENDESK_ORGANIZATION_FIELD_TYPE = 'organization_field'
const ZENDESK_MACRO_TYPE = 'macro'
const ZENDESK_GROUP_TYPE = 'group'
const ZENDESK_BRAND_TYPE = 'brand'
const ZENDESK_TICKET_FORM_TYPE = 'ticket_form'

export type ZendeskIndex = {
  elementsByInternalID: Record<string, Record<number, Readonly<InstanceElement>>>
  customFieldsByKey: Record<string, Record<string, Readonly<InstanceElement>>>
  ticketCustomOptionByFieldIdAndValue: Record<number, Record<string, Readonly<InstanceElement>>>
  customOptionsByFieldKeyAndValue: Record<string, Record<string, Record<string, Readonly<InstanceElement>>>>
}

type fieldWithOption = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    custom_field_options: ReferenceExpression[]
  }
}

const FIELD_SCHEMA = Joi.object({
  value: Joi.object({
    // eslint-disable-next-line camelcase
    custom_field_options: Joi.array().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isFieldWithOptions = createSchemeGuard<fieldWithOption>(FIELD_SCHEMA)

const indexElementsByInternalID = (elements: InstanceElement[]): Record<number, Readonly<InstanceElement>> =>
  _.keyBy(
    elements.filter(isInstanceElement).filter(e => !Number.isNaN(Number(e.value.id))),
    e => Number(e.value.id),
  )

const isKeyStringInstance = (element: Readonly<Element>): element is InstanceElement & { value: { key: string } } =>
  isInstanceElement(element) && element.value.key !== undefined && _.isString(element.value.key)

const indexByKey = (
  elements: ReadonlyArray<Readonly<Element>>,
  typeName: string,
): Record<string, Readonly<InstanceElement>> =>
  _.keyBy(
    elements.filter(isKeyStringInstance).filter(e => e.elemID.typeName === typeName),
    e => e.value.key,
  )

const isOptionValueInstance = (element: Readonly<Element>): element is InstanceElement & { value: { value: string } } =>
  isInstanceElement(element) && element.value.value !== undefined && _.isString(element.value.value)

const indexCustomOptionByFieldAndValue = (
  indexedFields: Record<string | number, Readonly<InstanceElement>>,
): Record<string | number, Record<string, Readonly<InstanceElement>>> => {
  const mapFieldsToCustomOptions = (field: Readonly<InstanceElement>): Record<string, Readonly<InstanceElement>> =>
    _.keyBy(
      isFieldWithOptions(field)
        ? field.value.custom_field_options
            .filter(isReferenceExpression)
            .map(ref => ref.value)
            .filter(isOptionValueInstance)
        : [],
      e => e.value.value,
    )

  return _.mapValues(indexedFields, mapFieldsToCustomOptions)
}

export const indexZendesk = (elements: ReadonlyArray<Readonly<Element>>): ZendeskIndex => {
  const instances = elements.filter(isInstanceElement)

  const fieldsByKey = {
    user: indexByKey(instances, ZENDESK_USER_FIELD_TYPE),
    organization: indexByKey(instances, ZENDESK_ORGANIZATION_FIELD_TYPE),
  }

  // User and organization custom fields parsed as field_<value.key>
  // whereas ticket custom field parsed as field_<ID>
  const optionsByFieldKeyAndValue = {
    user: indexCustomOptionByFieldAndValue(fieldsByKey.user),
    organization: indexCustomOptionByFieldAndValue(fieldsByKey.organization),
  }

  const internalIdIndex = {
    macros: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === ZENDESK_MACRO_TYPE)),
    groups: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === ZENDESK_GROUP_TYPE)),
    brands: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === ZENDESK_BRAND_TYPE)),
    ticketForms: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === ZENDESK_TICKET_FORM_TYPE)),
    ticketFields: indexElementsByInternalID(instances.filter(e => e.elemID.typeName === ZENDESK_TICKET_FIELD_TYPE)),
  }

  return {
    elementsByInternalID: internalIdIndex,
    customFieldsByKey: fieldsByKey,
    ticketCustomOptionByFieldIdAndValue: indexCustomOptionByFieldAndValue(internalIdIndex.ticketFields),
    customOptionsByFieldKeyAndValue: optionsByFieldKeyAndValue,
  }
}
