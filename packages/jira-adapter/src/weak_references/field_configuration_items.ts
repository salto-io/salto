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
import { GetCustomReferencesFunc, InstanceElement, isInstanceElement, isReferenceExpression, ReferenceInfo } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

const log = logger(module)

type FieldConfigurationItems = {
  [key: string]: {
    id: unknown
    description: string
    isHidden: boolean
    isRequired: boolean
    render: string
  }
}

const FIELD_CONFIGURATION_ITEM_SCHEME = Joi.object({
  id: Joi.required(),
  description: Joi.optional(),
  isHidden: Joi.boolean().required(),
  isRequired: Joi.boolean().required(),
  renderer: Joi.optional(),
})

const FIELD_CONFIGURATION_ITEMS_SCHEME = Joi.object().pattern(/.*/, FIELD_CONFIGURATION_ITEM_SCHEME)

const isFieldConfigurationItems = createSchemeGuard<FieldConfigurationItems>(FIELD_CONFIGURATION_ITEMS_SCHEME, 'Received an invalid field configuration items value')

const getFieldReferences = async (
  instance: InstanceElement,
): Promise<ReferenceInfo[]> => {
  const fieldConfigurationItems = instance.value.fields
  if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
    log.warn(`fields value is corrupted in instance ${instance.elemID.getFullName()}`)
    return []
  }
  return awu(Object.entries(fieldConfigurationItems))
    .map(async ([id, config]) => (
      isReferenceExpression(config.id)
        ? { source: instance.elemID.createNestedID('fields', id, 'id'),
          target: config.id.elemID,
          type: 'weak' as const }
        : undefined))
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each field reference in field configuration as a weak reference.
 */
const getFieldConfigurationItemsReferences: GetCustomReferencesFunc = async elements => log.time(() => awu(elements)
  .filter(isInstanceElement)
  .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
  .flatMap(instance => getFieldReferences(instance))
  .toArray(), 'getFieldConfigurationItemsReferences')

/**
 * Remove invalid fields (not references or missing references) from field configuration.
 */
const removeMissingFields: WeakReferencesHandler['removeWeakReferences'] = ({ elementsSource }) => async elements => log.time(async () => {
  const fixedElements = await awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .map(async instance => {
      const fieldConfigurationItems = instance.value.fields
      if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
        log.warn(`fields value is corrupted in instance ${instance.elemID.getFullName()}, hence not omitting missing fields`)
        return undefined
      }

      const fixedInstance = instance.clone()
      fixedInstance.value.fields = Object.fromEntries(await awu(Object.entries(fieldConfigurationItems))
        .filter(async ([_id, field]) =>
          (isReferenceExpression(field.id)
            // eslint-disable-next-line no-return-await
            && await elementsSource.has(field.id.elemID)
          )).toArray())

      if (Object.keys(fixedInstance.value.fields).length === Object.keys(instance.value.fields).length) {
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
}, 'removeMissingFields')

export const fieldConfigurationsHandler: WeakReferencesHandler = {
  findWeakReferences: getFieldConfigurationItemsReferences,
  removeWeakReferences: removeMissingFields,
}
