/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ElemIdGetter, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { JiraConfig } from '../../config/config'
import { JIRA } from '../../constants'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from './constants'

const { generateInstanceNameFromConfig } = elementUtils

// Added to avoid conflicts with names
// of custom fields and system fields
export const CUSTOM_FIELDS_SUFFIX = 'c'

const getFieldType = (instance: InstanceElement): string | undefined =>
  instance.value.schema?.custom?.split(':').slice(-1)[0] ?? instance.value.schema?.type

const isCustomField = (instance: InstanceElement): boolean => instance.value.schema?.custom !== undefined

const getInstanceName = (instance: InstanceElement, config: JiraConfig, getElemIdFunc?: ElemIdGetter): string => {
  const baseName = generateInstanceNameFromConfig(instance.value, instance.elemID.typeName, config.apiDefinitions)

  if (baseName === undefined) {
    return instance.elemID.name
  }

  const defaultName = naclCase(
    [
      baseName,
      config.fetch.addTypeToFieldName ?? true ? getFieldType(instance) : undefined,
      isCustomField(instance) ? CUSTOM_FIELDS_SUFFIX : undefined,
    ]
      .filter(values.isDefined)
      .join('__'),
  )

  const { serviceIdField } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[instance.elemID.typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation,
  )

  if (serviceIdField === undefined || getElemIdFunc === undefined) {
    return defaultName
  }

  const serviceIds = elementUtils.createServiceIds({
    entry: instance.value,
    serviceIDFields: [serviceIdField],
    typeID: instance.refType.elemID,
  })

  return getElemIdFunc(JIRA, serviceIds, defaultName).name
}

// Add __c suffix to custom fields and field type to their names to avoid conflicts between fields
const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  name: 'fieldNameFilter',
  onFetch: async (elements: Element[]) => {
    const fields = _.remove(
      elements,
      element => isInstanceElement(element) && element.elemID.typeName === FIELD_TYPE_NAME,
    )

    const newFields = fields.filter(isInstanceElement).map(instance => {
      const name = getInstanceName(instance, config, getElemIdFunc)
      return new InstanceElement(name, instance.refType, instance.value, instance.path, instance.annotations)
    })

    elements.push(...newFields)
  },
})

export default filter
