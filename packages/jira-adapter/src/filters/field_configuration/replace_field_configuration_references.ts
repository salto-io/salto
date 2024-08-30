/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  MapType,
  Values,
  ReadOnlyElementsSource,
  ReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'

const log = logger(module)

const { awu } = collections.asynciterable

const enrichFieldItem = async (
  fieldName: string,
  fieldItem: Value,
  elementSource: ReadOnlyElementsSource,
  instanceName: string,
): Promise<Exclude<Value, undefined> | undefined> => {
  if (!_.isPlainObject(fieldItem)) {
    log.warn('field item is not plain object - ignoring it')
    return undefined
  }
  const elemId = new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', fieldName)
  const fieldInstance = await elementSource.get(elemId)
  if (fieldInstance === undefined) {
    // not supposed to get here, since we run field-configuration fix-element
    log.debug(
      `Omitting element id ${elemId.getFullName()} from instance ${instanceName}, since it does not exist in the account`,
    )
    return undefined
  }
  return {
    id: new ReferenceExpression(elemId, fieldInstance),
    ...fieldItem,
  }
}

const replaceToMap = (instance: InstanceElement): void => {
  instance.value.fields = Object.fromEntries(
    instance.value.fields
      .filter((field: Values) => isResolvedReferenceExpression(field.id))
      .map((field: Values) => [field.id.elemID.name, _.omit(field, 'id')]),
  )
}

const replaceFromMap = async (instance: InstanceElement, elementSource: ReadOnlyElementsSource): Promise<void> => {
  const fieldConfigurationItems = instance.value.fields
  if (!_.isPlainObject(fieldConfigurationItems)) {
    log.warn(`fields value is corrupted in instance ${instance.elemID.getFullName()}, hence not changing fields format`)
    return
  }
  instance.value.fields = await awu(Object.entries(fieldConfigurationItems))
    .map(async ([fieldName, fieldItem]) =>
      enrichFieldItem(fieldName, fieldItem, elementSource, instance.elemID.getFullName()),
    )
    .filter(values.isDefined)
    .toArray()
}

const filter: FilterCreator = ({ config, elementsSource }) => ({
  name: 'replaceFieldConfigurationReferences',
  onFetch: async elements => {
    if (config.fetch.splitFieldConfiguration) {
      return
    }

    const fieldConfigType = findObject(elements, FIELD_CONFIGURATION_TYPE_NAME)
    if (fieldConfigType === undefined) {
      return
    }

    fieldConfigType.fields.fields = new Field(
      fieldConfigType,
      'fields',
      new MapType(fieldConfigType.fields.fields.refType),
      {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => Array.isArray(instance.value.fields))
      .forEach(replaceToMap)
  },

  preDeploy: async changes => {
    if (config.fetch.splitFieldConfiguration) {
      return
    }

    await awu(changes)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)
      .forEach(instance => replaceFromMap(instance, elementsSource))
  },

  onDeploy: async changes => {
    if (config.fetch.splitFieldConfiguration) {
      return
    }

    changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)
      .forEach(replaceToMap)
  },
})

export default filter
