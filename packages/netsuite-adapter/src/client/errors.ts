
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
import _ from 'lodash'
import { Change, ElemID, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isModificationChange, ObjectType } from '@salto-io/adapter-api'
import { CONFIG_FEATURES, SCRIPT_ID } from '../constants'

export class FeaturesDeployError extends Error {
  ids: string[]
  constructor(message: string, ids: string[]) {
    super(message)
    this.ids = ids
    this.name = 'FeaturesDeployError'
  }
}

export class ObjectsDeployError extends Error {
  failedObjects: Set<string>
  constructor(message: string, failedObjects: Set<string>) {
    super(message)
    this.failedObjects = failedObjects
    this.name = 'ObjectsDeployError'
  }
}

export class SettingsDeployError extends Error {
  failedConfigTypes: Set<string>
  constructor(message: string, failedConfigTypes: Set<string>) {
    super(message)
    this.failedConfigTypes = failedConfigTypes
    this.name = 'SettingsDeployError'
  }
}

export class ManifestValidationError extends Error {
  missingDependencyScriptIds: string[]
  constructor(message: string, missingDependencyScriptIds: string[]) {
    super(message)
    this.name = 'ManifestValidationError'
    this.missingDependencyScriptIds = missingDependencyScriptIds
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

export const toFeaturesDeployPartialSuccessResult = (
  error: FeaturesDeployError,
  changes: Change[]
): Change[] => {
  // this case happens when all changes where deployed successfully,
  // except of some features in config_features
  const [[featuresChange], successfullyDeployedChanges] = _.partition(
    changes, change => getChangeData(change).elemID.typeName === CONFIG_FEATURES
  )

  // if some changed features are not in errors.ids we want to include the change
  if (isInstanceChange(featuresChange) && isModificationChange(featuresChange) && !_.isEqual(
    _(featuresChange.data.before.value.feature)
      .keyBy(feature => feature.id).omit(error.ids).value(),
    _(featuresChange.data.after.value.feature)
      .keyBy(feature => feature.id).omit(error.ids).value(),
  )) {
    successfullyDeployedChanges.push(featuresChange)
  }

  return successfullyDeployedChanges
}

const getFailedManifestErrorElemIds = (
  error: ManifestValidationError,
  dependencyMap: Map<string, Set<string>>,
): ElemID[] => Array.from(dependencyMap.keys())
  .filter(topLevelChangedElement => error.missingDependencyScriptIds
    .some(scriptid => dependencyMap.get(topLevelChangedElement)?.has(scriptid)))
  .map(ElemID.fromFullName)

const getFailedSdfDeployChangesElemIDs = (
  error: ObjectsDeployError,
  changes: Change<InstanceElement | ObjectType>[],
): ElemID[] => changes
  .map(getChangeData)
  .filter(elem => (
    isInstanceElement(elem) && error.failedObjects.has(elem.value[SCRIPT_ID])
  ) || (
    error.failedObjects.has(elem.annotations[SCRIPT_ID])
  ))
  .map(elem => elem.elemID)

const getFailedSettingsErrorChanges = (
  error: SettingsDeployError,
  changes: Change<InstanceElement | ObjectType>[],
): ElemID[] => changes
  .map(change => getChangeData(change).elemID)
  .filter(changeElemId => error.failedConfigTypes.has(changeElemId.typeName))

export const getChangesElemIdsToRemove = (
  error: unknown,
  dependencyMap: Map<string, Set<string>>,
  changes: Change<InstanceElement | ObjectType>[]
): ElemID[] => {
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
