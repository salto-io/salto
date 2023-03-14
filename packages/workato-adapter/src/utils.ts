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

import { Change, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'

export function isFromType(type: string[]) {
  return (change: Change<InstanceElement> | InstanceElement): boolean => type.includes(
    (isInstanceElement(change) ? change : getChangeData(change)).elemID.typeName
  )
}

export const getRootFolderID = (folder: InstanceElement): number => {
  if (folder.value.parent_id === undefined) return folder.value.id
  return getRootFolderID(folder.value.parent_id.value)
}

export const getFolderPath = (folder: InstanceElement): string[] => {
  if (folder.value.parent_id === undefined) return []
  return [...getFolderPath(folder.value.parent_id.value), folder.value.name]
}
