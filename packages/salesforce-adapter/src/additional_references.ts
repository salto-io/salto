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
import { GetAdditionalReferencesFunc, getChangeData, isAdditionChange, isFieldChange, isInstanceChange, isRemovalOrModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { isFieldOfCustomObject } from './transformers/transformer'
import { isInstanceOfType, safeApiName } from './filters/utils'
import { API_NAME_SEPARATOR, FIELD_PERMISSIONS, PERMISSION_SET_METADATA_TYPE, PROFILE_METADATA_TYPE } from './constants'

const { awu } = collections.asynciterable


export const getAdditionalReferences: GetAdditionalReferencesFunc = async changes => {
  const relevantFields = await awu(changes)
    .filter(isFieldChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isFieldOfCustomObject)
    .toArray()

  if (relevantFields.length === 0) {
    return []
  }

  const profilesAndPermissionSets = await awu(changes)
    .filter(isRemovalOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => isInstanceOfType(PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE)(instance))
    .toArray()

  return awu(relevantFields)
    .flatMap(async field => {
      const fieldApiName = await safeApiName(field)
      if (fieldApiName === undefined) {
        return []
      }
      return profilesAndPermissionSets
        .filter(instance => _.get(instance.value.fieldPermissions, fieldApiName) !== undefined)
        .map(instance => ({
          source: instance.elemID.createNestedID(FIELD_PERMISSIONS, ...fieldApiName.split(API_NAME_SEPARATOR)),
          target: field.elemID,
        }))
    })
    .toArray()
}
