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
