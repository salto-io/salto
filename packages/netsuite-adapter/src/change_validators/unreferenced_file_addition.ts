/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import {
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  ChangeError,
  isReferenceExpression,
  ChangeDataType,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, WalkOnFunc, walkOnElement } from '@salto-io/adapter-utils'
import { isFileInstance } from '../types'
import { NetsuiteChangeValidator } from './types'

const getUnreferencedFilesFullNames = (files: InstanceElement[], changesData: ChangeDataType[]): Set<string> => {
  const unreferencedFilesFullNames = new Set(files.map(file => file.elemID.getFullName()))

  const func: WalkOnFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      unreferencedFilesFullNames.delete(value.elemID.createTopLevelParentID().parent.getFullName())
      if (unreferencedFilesFullNames.size === 0) {
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }

  changesData.forEach(element => walkOnElement({ element, func }))
  return unreferencedFilesFullNames
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const additionAndModificationChanges = changes.filter(isAdditionOrModificationChange)
  const fileAdditions = additionAndModificationChanges
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(isFileInstance)

  if (fileAdditions.length === 0) {
    return []
  }

  const unreferencedFilesFullNames = getUnreferencedFilesFullNames(
    fileAdditions,
    additionAndModificationChanges.map(getChangeData),
  )

  return fileAdditions
    .filter(file => unreferencedFilesFullNames.has(file.elemID.getFullName()))
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Warning',
        message: 'File not referenced by any element',
        detailedMessage:
          "This file isn't referenced by any other element. This may indicate that you forgot to include some element in your deployment which uses this file.",
      }),
    )
}

export default changeValidator
