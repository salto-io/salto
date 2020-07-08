/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import {
  Change, ChangeGroupIdFunction, getChangeElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { customTypes, fileCabinetTypes } from './types'

export const SDF_CHANGE_GROUP_ID = 'SDF'

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const isSdfChange = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isInstanceElement(changeElement)
      && (Object.keys(customTypes).includes(changeElement.elemID.typeName)
        || Object.keys(fileCabinetTypes).includes(changeElement.elemID.typeName))
  }
  return new Map(
    wu(changes.entries())
      .filter(([_id, change]) => isSdfChange(change))
      .map(([id]) => [id, SDF_CHANGE_GROUP_ID])
  )
}
