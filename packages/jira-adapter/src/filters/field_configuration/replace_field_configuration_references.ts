/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, Values, Value } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)

const enrichFieldItem = (
  fieldName: string,
  fieldItem: Value,
  nameToFieldMap: Record<string, InstanceElement>,
  instanceName: string,
): Value => {
  if (!_.isPlainObject(fieldItem)) {
    log.warn('ignoring field item %s in instance %s that is not plain object: %o', fieldName, instanceName, fieldItem)
    return undefined
  }
  if (nameToFieldMap[fieldName] === undefined) {
    // not supposed to get here, since we run field-configuration fix-element
    log.debug(`Omitting element id ${fieldName} from instance ${instanceName}, since it does not exist in the account`)
    return undefined
  }
  return {
    id: nameToFieldMap[fieldName].value.id,
    ...fieldItem,
  }
}

export const replaceToMap = (instance: InstanceElement, idToFieldMap: Record<string, InstanceElement>): void => {
  instance.value.fields = Object.fromEntries(
    instance.value.fields
      .filter((field: Values) => idToFieldMap[field.id] !== undefined)
      .map((field: Values) => [idToFieldMap[field.id].elemID.name, _.omit(field, 'id')]),
  )
}

export const replaceFromMap = (instance: InstanceElement, nameToFieldMap: Record<string, InstanceElement>): void => {
  const fieldConfigurationItems = instance.value.fields
  if (fieldConfigurationItems === undefined) {
    log.warn('fields value is missing in instance %s, hence not changing fields format', instance.elemID.getFullName())
    return
  }
  if (!_.isPlainObject(fieldConfigurationItems)) {
    log.warn(
      'fields value is corrupted in instance %s, hence not changing fields format: %o',
      instance.elemID.getFullName(),
      fieldConfigurationItems,
    )
    return
  }
  instance.value.fields = Object.entries(fieldConfigurationItems)
    .map(([fieldName, fieldItem]) =>
      enrichFieldItem(fieldName, fieldItem, nameToFieldMap, instance.elemID.getFullName()),
    )
    .filter(values.isDefined)
}
