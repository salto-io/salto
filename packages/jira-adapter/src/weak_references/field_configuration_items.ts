/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ElemID,
  GetCustomReferencesFunc,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
  ReferenceInfo,
} from '@salto-io/adapter-api'
import { collections, promises, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

type FieldElemIDsMap = collections.map.DefaultMap<string, ElemID>

const { awu } = collections.asynciterable
const { DefaultMap } = collections.map
const { pickAsync } = promises.object

const log = logger(module)

const getFieldReferences = (instance: InstanceElement, fieldElemIdsMap: FieldElemIDsMap): ReferenceInfo[] => {
  const fieldConfigurationItems = instance.value.fields
  if (fieldConfigurationItems === undefined) {
    return []
  }
  if (!_.isPlainObject(fieldConfigurationItems)) {
    log.warn(
      'fields value is corrupted in instance %s, hence not calculating fields weak references: %o',
      instance.elemID.getFullName(),
      fieldConfigurationItems,
    )
    return []
  }
  return Object.keys(fieldConfigurationItems)
    .map(fieldName => ({
      source: instance.elemID.createNestedID('fields', fieldName),
      target: fieldElemIdsMap.get(fieldName),
      type: 'weak' as const,
    }))
    .filter(values.isDefined)
}

/**
 * Marks each field reference in field configuration as a weak reference.
 */
const getFieldConfigurationItemsReferences: GetCustomReferencesFunc = async elements =>
  log.timeDebug(() => {
    const fieldConfigurationInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    log.debug('going to create references from %d FieldConfiguration instances', fieldConfigurationInstances.length)
    const fieldElemIdsMap = new DefaultMap<string, ElemID>(
      fieldName => new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', fieldName),
    )
    const references = fieldConfigurationInstances.flatMap(instance => getFieldReferences(instance, fieldElemIdsMap))
    log.debug(
      'created %d references to %d Field instances from %d FieldConfiguration instances',
      references.length,
      fieldElemIdsMap.size,
      fieldConfigurationInstances.length,
    )
    return references
  }, 'getFieldConfigurationItemsReferences')

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
    log.timeDebug(async () => {
      const fixedElements = await awu(elements)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
        .map(async instance => {
          const fieldConfigurationItems = instance.value.fields
          if (fieldConfigurationItems === undefined) {
            return undefined
          }
          if (!_.isPlainObject(fieldConfigurationItems)) {
            log.warn(
              'fields value is corrupted in instance %s, hence not omitting missing fields: %o',
              instance.elemID.getFullName(),
              fieldConfigurationItems,
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
