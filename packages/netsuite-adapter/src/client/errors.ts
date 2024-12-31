/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Change, ElemID, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { CONFIG_FEATURES, SCRIPT_ID } from '../constants'
import { DeployResult, getElementValueOrAnnotations } from '../types'
import { DeployableChange } from './types'
import { getGroupItemFromRegex, toElementError } from './utils'
import { OBJECT_ID } from './language_utils'

const log = logger(module)

type Message = {
  message: string
  detailedMessage?: string
}
type MessageAndElemID = Message & { elemID: ElemID }
type MessageAndScriptId = Message & { scriptId: string }

export class PartialSuccessDeployErrors extends Error {
  errors: Error[]
  constructor(message: string, errors: Error[]) {
    super(message)
    this.errors = errors
    this.name = 'PartialSuccessDeployErrors'
  }
}

export class FeaturesDeployError extends Error {
  ids: string[]
  constructor(message: string, ids: string[]) {
    super(message)
    this.ids = ids
    this.name = 'FeaturesDeployError'
  }
}

export class DeployWarning extends Error {
  objectId: string
  constructor(objectId: string, message: string) {
    super(message)
    this.objectId = objectId
    this.name = 'DeployWarning'
  }
}

export class ObjectsDeployError extends Error {
  failedObjects: Map<string, Message[]>
  constructor(message: string, failedObjects: Map<string, Message[]>) {
    super(message)
    this.failedObjects = failedObjects
    this.name = 'ObjectsDeployError'
  }
}

export class SettingsDeployError extends Error {
  failedConfigTypes: Map<string, Message[]>
  constructor(message: string, failedConfigTypes: Map<string, Message[]>) {
    super(message)
    this.failedConfigTypes = failedConfigTypes
    this.name = 'SettingsDeployError'
  }
}

export class ManifestValidationError extends Error {
  missingDependencies: MessageAndScriptId[]
  constructor(message: string, missingDependencies: MessageAndScriptId[]) {
    super(message)
    this.name = 'ManifestValidationError'
    this.missingDependencies = missingDependencies
  }
}

export class MissingManifestFeaturesError extends Error {
  missingFeatures: string[]
  constructor(message: string, missingFeatures: string[]) {
    super(message)
    this.name = 'MissingManifestFeaturesError'
    this.missingFeatures = missingFeatures
  }
}

export const getFailedObjects = (messages: string[], ...regexes: RegExp[]): MessageAndScriptId[] =>
  messages.flatMap(message =>
    regexes.flatMap(regex => getGroupItemFromRegex(message, regex, OBJECT_ID)).map(scriptId => ({ scriptId, message })),
  )

export const getFailedObjectsMap = (messages: string[], ...regexes: RegExp[]): Map<string, MessageAndScriptId[]> =>
  new Map(Object.entries(_.groupBy(getFailedObjects(messages, ...regexes), obj => obj.scriptId)))

const toFeaturesDeployPartialSuccessResult = (error: FeaturesDeployError, changes: Change[]): Change[] => {
  // this case happens when all changes where deployed successfully,
  // except of some features in config_features
  const [[featuresChange], successfullyDeployedChanges] = _.partition(
    changes,
    change => getChangeData(change).elemID.typeName === CONFIG_FEATURES,
  )

  // if some changed features are not in errors.ids we want to include the change
  if (
    isInstanceChange(featuresChange) &&
    isModificationChange(featuresChange) &&
    !_.isEqual(
      _(featuresChange.data.before.value.feature)
        .keyBy(feature => feature.id)
        .omit(error.ids)
        .value(),
      _(featuresChange.data.after.value.feature)
        .keyBy(feature => feature.id)
        .omit(error.ids)
        .value(),
    )
  ) {
    successfullyDeployedChanges.push(featuresChange)
  }

  return successfullyDeployedChanges
}

export const toPartialSuccessDeployResult = (
  partialSuccessDeployError: PartialSuccessDeployErrors,
  baseDeployResult: DeployResult,
): DeployResult =>
  partialSuccessDeployError.errors.reduce((deployResult, error) => {
    const { errors, appliedChanges } = deployResult
    const { message } = error
    if (error instanceof FeaturesDeployError) {
      const featuresError = appliedChanges
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(inst => inst.elemID.typeName === CONFIG_FEATURES)
        .map(({ elemID }) => toElementError({ elemID, message, detailedMessage: message }))

      return {
        errors: errors.concat(featuresError),
        appliedChanges: toFeaturesDeployPartialSuccessResult(error, appliedChanges),
        failedFeaturesIds: error.ids,
      }
    }
    if (error instanceof DeployWarning) {
      const element = appliedChanges
        .map(getChangeData)
        .find(elem => getElementValueOrAnnotations(elem)[SCRIPT_ID] === error.objectId)
      if (element === undefined) {
        log.warn('missing objectId %s in appliedChanges - ignoring error: %s', error.objectId, error.message)
        return deployResult
      }
      return {
        ...deployResult,
        errors: errors.concat({
          elemID: element.elemID,
          message,
          detailedMessage: message,
          severity: 'Warning',
        }),
      }
    }
    log.error('unknown partial deploy error: %o', error)
    return deployResult
  }, baseDeployResult)

const getFailedManifestErrorElemIds = (
  error: ManifestValidationError,
  dependencyMap: Map<string, Set<string>>,
): MessageAndElemID[] =>
  Array.from(dependencyMap.keys()).flatMap(elemId => {
    const elemID = ElemID.fromFullName(elemId)
    const dependencies = dependencyMap.get(elemId)
    return error.missingDependencies
      .filter(dep => dependencies?.has(dep.scriptId))
      .map(dep => ({ elemID, message: dep.message }))
  })

const getFailedSdfDeployChangesElemIDs = (error: ObjectsDeployError, changes: DeployableChange[]): MessageAndElemID[] =>
  changes.map(getChangeData).flatMap(elem => {
    const failedObjectErrors = error.failedObjects.get(getElementValueOrAnnotations(elem)[SCRIPT_ID])
    return failedObjectErrors?.map(({ message }) => ({ elemID: elem.elemID, message })) ?? []
  })

const getFailedSettingsErrorChanges = (error: SettingsDeployError, changes: DeployableChange[]): MessageAndElemID[] =>
  changes
    .map(getChangeData)
    .flatMap(
      ({ elemID }) => error.failedConfigTypes.get(elemID.typeName)?.map(({ message }) => ({ elemID, message })) ?? [],
    )

export const getChangesElemIdsToRemove = (
  error: unknown,
  dependencyMap: Map<string, Set<string>>,
  changes: DeployableChange[],
): MessageAndElemID[] => {
  if (error instanceof ManifestValidationError) {
    return getFailedManifestErrorElemIds(error, dependencyMap)
  }
  if (error instanceof ObjectsDeployError) {
    return getFailedSdfDeployChangesElemIDs(error, changes)
  }
  if (error instanceof SettingsDeployError) {
    return getFailedSettingsErrorChanges(error, changes)
  }
  return []
}
