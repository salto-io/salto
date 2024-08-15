/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import {
  Change,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  ElemID,
  isAdditionOrModificationChange,
  AdditionChange,
} from '@salto-io/adapter-api'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { SCHEMA_TYPES } from '../constants'
import { BASE_PATH } from '../change_validators/app_user_schema_base_properties'

const log = logger(module)

const CUSTOM_PROPERTIES_PATH = ['definitions', 'custom', 'properties']

const getBaseElemID = (appUserSchemaInstance: InstanceElement): ElemID =>
  appUserSchemaInstance.elemID.createNestedID(...BASE_PATH)

const setBaseField = (change: ModificationChange<InstanceElement>): void => {
  const { before, after } = change.data
  const baseElemId = getBaseElemID(after)
  setPath(after, baseElemId, resolvePath(before, baseElemId))
}

const addNullToRemovedProperties = (change: ModificationChange<InstanceElement>): void => {
  const { before, after } = change.data

  const customPropertiesElemID = after.elemID.createNestedID(...CUSTOM_PROPERTIES_PATH)

  const beforeCustomProperties = resolvePath(before, customPropertiesElemID)
  if (!values.isPlainRecord(beforeCustomProperties)) {
    return
  }

  const updatedAfterCustomProperties = resolvePath(after, customPropertiesElemID)
  const afterCustomPropertiesKeys = new Set(Object.keys(updatedAfterCustomProperties))
  const propertiesToRemove = Object.keys(beforeCustomProperties).filter(key => !afterCustomPropertiesKeys.has(key))

  propertiesToRemove.forEach(property => {
    updatedAfterCustomProperties[property] = null
  })
}

const ensureCustomPropertiesExists = (instance: InstanceElement): void => {
  const customPropertiesElemID = instance.elemID.createNestedID(...CUSTOM_PROPERTIES_PATH)
  const afterCustomProperties = resolvePath(instance, customPropertiesElemID)
  if (!values.isPlainRecord(afterCustomProperties)) {
    if (afterCustomProperties !== undefined) {
      log.error(`Custom properties should be a record. Instance: ${instance.elemID.getFullName()}`)
    }
    setPath(instance, customPropertiesElemID, {})
  }
}
const makeCustomPropertiesDeployable = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): void => {
  ensureCustomPropertiesExists(getChangeData(change))
  if (isModificationChange(change)) {
    addNullToRemovedProperties(change)
  }
}

const returnValueToOriginal = (
  instance: InstanceElement,
  originalInstance: InstanceElement,
  nestedElemId: ElemID,
): void => {
  const originalValue = resolvePath(originalInstance, nestedElemId)
  setPath(instance, nestedElemId, originalValue)
}

export const makeSchemaDeployable = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  elemIdToOriginalAfter: Record<string, InstanceElement>,
): void => {
  const { after } = change.data
  elemIdToOriginalAfter[after.elemID.getFullName()] = after.clone()
  makeCustomPropertiesDeployable(change)
  if (isModificationChange(change)) {
    setBaseField(change)
  }
}

const returnToOriginalForm = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  elemIdToOriginalAfter: Record<string, InstanceElement>,
): void => {
  const { after } = change.data
  const originalAfter = elemIdToOriginalAfter[getChangeData(change).elemID.getFullName()]
  if (originalAfter === undefined) {
    log.error(`Could not find original after value in the onDeploy for ${after.elemID.getFullName()}`)
    return
  }
  returnValueToOriginal(after, originalAfter, after.elemID.createNestedID(...CUSTOM_PROPERTIES_PATH))
  if (isModificationChange(change)) {
    returnValueToOriginal(after, originalAfter, getBaseElemID(after))
  }
}

/**
 * This filter is used to make schema instances deployable, it effects the custom properties and the base fields.
 *
 * Custom Properties
 * When deploying a schema, the schema must contain custom properties field.
 * In addition, to delete a custom property from a schema, the custom property is set to null.
 *
 * Base
 * Okta's API does not allow to deploy changes to base attributes.
 * we deploy the base from the before and change it back in the onDeploy.
 */
const filterCreator: FilterCreator = () => {
  const elemIdToOriginalAfter: Record<string, InstanceElement> = {}
  return {
    name: 'schemaDeploymentFilter',
    preDeploy: async (changes: Change<InstanceElement>[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => SCHEMA_TYPES.includes(getChangeData(change).elemID.typeName))
        .forEach(change => makeSchemaDeployable(change, elemIdToOriginalAfter)),
    onDeploy: async (changes: Change<InstanceElement>[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => SCHEMA_TYPES.includes(getChangeData(change).elemID.typeName))
        .forEach(change => returnToOriginalForm(change, elemIdToOriginalAfter)),
  }
}

export default filterCreator
