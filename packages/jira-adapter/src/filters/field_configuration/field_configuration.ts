/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  isObjectType,
  Element,
  InstanceElement,
  isInstanceElement,
  Field,
  MapType,
  CORE_ANNOTATIONS,
  isInstanceChange,
  isAdditionOrModificationChange,
  getChangeData,
  TypeReference,
  isContainerType,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { setFieldDeploymentAnnotations, setTypeDeploymentAnnotationsRecursively } from '../../utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'
import {
  addFieldConfigurationItemDefaultValues,
  removeFieldConfigurationItemDefaultValues,
} from './field_configuration_default_values'
import { replaceFromMap, replaceToMap } from './replace_field_configuration_references'

const log = logger(module)

const ID_PATH = ['value', 'id']
const NAME_PATH = ['elemID', 'name']

const toMapType = (refType: TypeReference): MapType => {
  if (refType.type === undefined) {
    log.warn('type is missing in refType %s', refType.elemID.getFullName())
    return new MapType(refType)
  }
  if (!isContainerType(refType.type)) {
    log.warn('expected %s to be a container refType', refType.elemID.getFullName())
    return new MapType(refType)
  }
  return new MapType(refType.type.refInnerType)
}

const updateFieldConfigurationType = async (elements: Element[]): Promise<void> => {
  const types = elements.filter(isObjectType)

  const fieldConfigurationType = types.find(type => type.elemID.name === FIELD_CONFIGURATION_TYPE_NAME)

  if (fieldConfigurationType === undefined) {
    log.warn(`${FIELD_CONFIGURATION_TYPE_NAME} type not found`)
  } else {
    setFieldDeploymentAnnotations(fieldConfigurationType, 'fields')
    fieldConfigurationType.fields.fields = new Field(
      fieldConfigurationType,
      'fields',
      toMapType(fieldConfigurationType.fields.fields.refType),
      {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    )
  }

  const fieldConfigurationItemType = types.find(type => type.elemID.name === FIELD_CONFIGURATION_ITEM_TYPE_NAME)

  if (fieldConfigurationItemType === undefined) {
    log.warn(`${FIELD_CONFIGURATION_ITEM_TYPE_NAME} type not found`)
  } else {
    await setTypeDeploymentAnnotationsRecursively(fieldConfigurationItemType)
  }
}

const createFieldsMap = (instances: InstanceElement[], path: string[]): Record<string, InstanceElement> =>
  Object.fromEntries(
    instances
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .map(instance => [_.get(instance, path), instance]),
  )

const removeLockedFields = (instance: InstanceElement, idToFieldMap: Record<string, InstanceElement>): void => {
  const [fields, trashedFields] = _.partition(
    instance.value.fields,
    field => idToFieldMap[field.id] !== undefined && !idToFieldMap[field.id].value.isLocked,
  )

  instance.value.fields = fields
  if (trashedFields.length !== 0) {
    log.debug(
      `Removed from ${instance.elemID.getFullName()} fields with ids: ${trashedFields.map(field => field.id).join(', ')}`,
    )
  }
}

// handles various aspects of field configuration:
// 1. Removes default values from field configuration items
// 2. changes the fields from an array to a map
// 3. Adds default values to field configuration items
// 4. Removes locked fields
// 5. changes the types to better reflect the field configuration
const filter: FilterCreator = ({ config, fetchQuery, elementsSource }) => ({
  name: 'fieldConfigurationFilter',
  onFetch: async elements => {
    await updateFieldConfigurationType(elements)

    if (!fetchQuery.isTypeMatch(FIELD_TYPE_NAME)) {
      log.warn(
        'Field type is not included in the fetch list so we cannot know what fields is in trash. Skipping the fieldConfigurationFilter',
      )
      return
    }
    const fieldConfigurationInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)

    if (fieldConfigurationInstances.length === 0) {
      return
    }
    const idToFieldMap = createFieldsMap(elements.filter(isInstanceElement), ID_PATH)

    fieldConfigurationInstances.forEach(instance => {
      removeLockedFields(instance, idToFieldMap)
      if (config.fetch.removeFieldConfigurationDefaultValues) {
        removeFieldConfigurationItemDefaultValues(instance, idToFieldMap)
      }
      replaceToMap(instance, idToFieldMap)
    })
  },
  preDeploy: async changes => {
    const fieldConfigurationInstances = changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)

    if (fieldConfigurationInstances.length === 0) {
      return
    }

    const fieldInstances = await getInstancesFromElementSource(elementsSource, [FIELD_TYPE_NAME])
    const nameToFieldMap = createFieldsMap(fieldInstances, NAME_PATH)
    const idToFieldMap = createFieldsMap(fieldInstances, ID_PATH)

    fieldConfigurationInstances.forEach(instance => {
      replaceFromMap(instance, nameToFieldMap)
      if (config.fetch.removeFieldConfigurationDefaultValues) {
        addFieldConfigurationItemDefaultValues(instance, idToFieldMap)
      }
    })
  },
  onDeploy: async changes => {
    const fieldConfigurationInstances = changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)

    if (fieldConfigurationInstances.length === 0) {
      return
    }

    const fieldInstances = await getInstancesFromElementSource(elementsSource, [FIELD_TYPE_NAME])
    const idToFieldMap = createFieldsMap(fieldInstances, ID_PATH)

    fieldConfigurationInstances.forEach(instance => {
      if (config.fetch.removeFieldConfigurationDefaultValues) {
        removeFieldConfigurationItemDefaultValues(instance, idToFieldMap)
      }
      replaceToMap(instance, idToFieldMap)
    })
  },
})

export default filter
