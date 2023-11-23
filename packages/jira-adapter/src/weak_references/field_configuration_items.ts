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
  FixElementsFunc,
  GetCustomReferencesFunc,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceInfo,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable


type FieldConfigurationItems = {
  id: unknown
  description: string
  isHidden: boolean
  isRequired: boolean
}[]

const FIELD_CONFIGURATION_ITEMS_SCHEME = Joi.array().items(
  Joi.object({
    fieldId: Joi.optional(),
  }).unknown(true),
)

const isFieldConfigurationItems = createSchemeGuard<FieldConfigurationItems>(FIELD_CONFIGURATION_ITEMS_SCHEME, 'Received an invalid field configuration item value')

const getFieldReferences = async (
  instance: InstanceElement,
): Promise<ReferenceInfo[]> => {
  const fieldConfigurationItems = instance.value.fields
  if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
    return []
  }

  return awu(fieldConfigurationItems)
    .map(async (field, index) => (
      isReferenceExpression(field.id)
        ? { source: instance.elemID.createNestedID(index.toString(), 'fieldId'), target: field.id.elemID, type: 'weak' as const }
        : undefined))
    .filter(values.isDefined)
    .toArray()
}

const getFieldConfigurationItemsReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .flatMap(instance => getFieldReferences(instance))
    .toArray()

const removeMissingFields: WeakReferencesHandler['removeWeakReferences'] = ({ elementsSource })
  : FixElementsFunc => async elements => {
  const fixedElements = await awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .map(async instance => {
      const fieldConfigurationItems = instance.value.fields
      if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
        return undefined
      }

      const fixedInstance = instance.clone()
      fixedInstance.value.fields = await awu(fieldConfigurationItems)
        .filter(async field => (field.id === undefined
          || (
            isReferenceExpression(field.id)
            // eslint-disable-next-line no-return-await
            && await elementsSource.has(field.id.elemID)
          )))
        .toArray()

      if (fixedInstance.value.fields.length === instance.value.fields.length) {
        return undefined
      }

      return fixedInstance
    })
    .filter(values.isDefined)
    .toArray()

  const errors = fixedElements.map(instance => ({
    elemID: instance.elemID.createNestedID('fields'),
    severity: 'Info' as const,
    message: 'Deploying field configuration without all attached field configuration items',
    detailedMessage: 'This field configuration is attached to some field configuration items that do not exist in the target environment. It will be deployed without referencing these field configuration items.',
  }))
  return { fixedElements, errors }
}

export const fieldConfigurationsHandler: WeakReferencesHandler = {
  findWeakReferences: getFieldConfigurationItemsReferences,
  removeWeakReferences: removeMissingFields,
}
