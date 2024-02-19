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
  ElemID,
  GetCustomReferencesFunc,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
  ReferenceInfo,
} from '@salto-io/adapter-api'
import { collections, promises, values } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable
const { pickAsync } = promises.object

const log = logger(module)

export type FieldItem = {
  description?: string
  isHidden?: boolean
  isRequired?: boolean
  renderer?: string
}

type FieldConfigurationItems = {
  [key: string]: FieldItem
}

const FIELD_CONFIGURATION_ITEM_SCHEME = Joi.object({
  description: Joi.optional(),
  isHidden: Joi.boolean().optional(),
  isRequired: Joi.boolean().optional(),
  renderer: Joi.optional(),
})

const FIELD_CONFIGURATION_ITEMS_SCHEME = Joi.object().pattern(/.*/, FIELD_CONFIGURATION_ITEM_SCHEME)

export const isFieldConfigurationItems = createSchemeGuard<FieldConfigurationItems>(FIELD_CONFIGURATION_ITEMS_SCHEME)

const getFieldReferences = (instance: InstanceElement): ReferenceInfo[] => {
  const fieldConfigurationItems = instance.value.fields
  if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
    log.warn(
      `fields value is corrupted in instance ${instance.elemID.getFullName()}, hence not calculating fields weak references`,
    )
    return []
  }
  return Object.keys(fieldConfigurationItems)
    .map(fieldName => {
      const elemId = new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', fieldName)
      return {
        source: instance.elemID.createNestedID('fields', fieldName),
        target: elemId,
        type: 'weak' as const,
      }
    })
    .filter(values.isDefined)
}

/**
 * Marks each field reference in field configuration as a weak reference.
 */
const getFieldConfigurationItemsReferences: GetCustomReferencesFunc = async elements =>
  log.time(
    () =>
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
        .flatMap(getFieldReferences),
    'getFieldConfigurationItemsReferences',
  )

const fieldExists = async (fieldName: string, elementSource: ReadOnlyElementsSource): Promise<boolean> => {
  const elemId = new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', fieldName)
  return elementSource.has(elemId)
}

/**
 * Remove invalid fields (not references or missing references) from field configuration.
 */
const removeMissingFields: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements =>
    log.time(async () => {
      const fixedElements = await awu(elements)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
        .map(async instance => {
          const fieldConfigurationItems = instance.value.fields
          if (fieldConfigurationItems === undefined || !isFieldConfigurationItems(fieldConfigurationItems)) {
            log.warn(
              `fields value is corrupted in instance ${instance.elemID.getFullName()}, hence not omitting missing fields`,
            )
            return undefined
          }

          const fixedInstance = instance.clone()
          fixedInstance.value.fields = await pickAsync(fieldConfigurationItems, (_field, fieldName) =>
            fieldExists(fieldName, elementsSource),
          )
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
        message: 'Deploying field configuration without all of its fields',
        detailedMessage:
          'This field configuration references some fields that do not exist in the target environment. It will be deployed without them.',
      }))
      return { fixedElements, errors }
    }, 'removeMissingFields')

export const fieldConfigurationsHandler: WeakReferencesHandler = {
  findWeakReferences: getFieldConfigurationItemsReferences,
  removeWeakReferences: removeMissingFields,
}
