/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { DataManagementConfig } from '../types'

export type DataManagement = {
  isObectMatch: (name: string) => boolean
  isReferenceAllowed: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
}

export const buildDataManagement = (params: DataManagementConfig): DataManagement => (
  {
    isObectMatch: name => params.includeObjects.some(re => new RegExp(re).test(name))
      && !params.excludeObjects?.some(re => new RegExp(re).test(name)),

    isReferenceAllowed: name => params.allowReferenceTo?.some(re => new RegExp(re).test(name))
      ?? false,

    getObjectIdsFields: name => {
      const matchedOverride = params.saltoIDSettings.overrides
        ?.find(override => new RegExp(override.objectsRegex).test(name))
      return matchedOverride?.idFields ?? params.saltoIDSettings.defaultIdFields
    },
  }
)
