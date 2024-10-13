/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData, InstanceElement, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { apiNameSync, ensureSafeFilterFetch, isInstanceOfTypeChangeSync, isInstanceOfTypeSync } from './utils'
import { FLOW_METADATA_TYPE } from '../constants'

const log = logger(module)

const TYPES_WITH_COORDINATES = [
  'FlowActionCall',
  'FlowApexPluginCall',
  'FlowAssignment',
  'FlowCollectionProcessor',
  'FlowCustomError',
  'FlowDecision',
  'FlowLoop',
  'FlowOrchestratedStage',
  'FlowRecordCreate',
  'FlowRecordDelete',
  'FlowRecordLookup',
  'FlowRecordRollback',
  'FlowRecordUpdate',
  'FlowScreen',
  'FlowStart',
  'FlowStep',
  'FlowSubflow',
  'FlowTransform',
  'FlowWait',
]

const isInCanvasAutoLayoutMode = (instance: InstanceElement): boolean => {
  if (!instance.value.processMetadataValues) {
    return false
  }
  const canvasMode = instance.value.processMetadataValues.find(({ name }: { name: string }) => name === 'CanvasMode')
  return canvasMode?.value?.stringValue === 'AUTO_LAYOUT_CANVAS'
}

const removeCoordinatesFromAllSections: TransformFuncSync = ({ value, field }) => {
  if (!field) {
    return value
  }
  const typeName = apiNameSync(field.parent)
  if (!typeName || !TYPES_WITH_COORDINATES.includes(typeName)) {
    return value
  }

  if (['locationX', 'locationY'].includes(field.name)) {
    log.debug('Removing field %s', field.elemID.getFullName())
    return undefined
  }

  return value
}

const addZeroCoordinatesToAllSections: TransformFuncSync = ({ value, field }) => {
  if (!field) {
    return value
  }
  const typeName = apiNameSync(field.getTypeSync())
  if (!typeName || !TYPES_WITH_COORDINATES.includes(typeName)) {
    return value
  }

  log.debug('Adding field %s.{locationX,locationY}', field.elemID.getFullName())

  value.locationX = value.locationX ?? 0
  value.locationY = value.locationY ?? 0

  return value
}

const FILTER_NAME = 'flowCoordinates'

const filter: FilterCreator = ({ config }) => ({
  name: FILTER_NAME,
  onFetch: ensureSafeFilterFetch({
    warningMessage: '',
    config,
    filterName: FILTER_NAME,
    fetchFilterFunc: async elements => {
      elements
        .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
        .filter(isInCanvasAutoLayoutMode)
        .forEach(instance => {
          instance.value = transformValuesSync({
            values: instance.value,
            type: instance.getTypeSync(),
            transformFunc: removeCoordinatesFromAllSections,
          })
        })
    },
  }),
  preDeploy: async changes => {
    if (!config.fetchProfile.isFeatureEnabled(FILTER_NAME)) {
      return
    }
    changes
      .filter(isInstanceOfTypeChangeSync(FLOW_METADATA_TYPE))
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .forEach(instance => {
        instance.value = transformValuesSync({
          values: instance.value,
          type: instance.getTypeSync(),
          transformFunc: addZeroCoordinatesToAllSections,
        })
      })
  },
  onDeploy: async changes => {
    if (!config.fetchProfile.isFeatureEnabled(FILTER_NAME)) {
      return
    }
    changes
      .filter(isInstanceOfTypeChangeSync(FLOW_METADATA_TYPE))
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInCanvasAutoLayoutMode)
      .forEach(instance => {
        instance.value = transformValuesSync({
          values: instance.value,
          type: instance.getTypeSync(),
          transformFunc: removeCoordinatesFromAllSections,
        })
      })
  },
})

export default filter
