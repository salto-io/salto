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
import path from 'path'
import { ChangeError, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { FOLDER, INTERNAL_ID, PATH } from '../constants'
import { isFileCabinetInstance } from '../types'
import { NetsuiteChangeValidator } from './types'

const missingParentMessage = 'Missing parent folder reference'
const parentMismatchMessage = `Mismatch between path and "${CORE_ANNOTATIONS.PARENT}" annotation`

export const getParentInternalId = (
  instance: InstanceElement,
  addedFolders?: Set<string>
): { id?: number; error?: Pick<ChangeError, 'message' | 'detailedMessage'> } => {
  const parentDirectory = path.dirname(instance.value[PATH])
  const isTopLevelFolderPath = parentDirectory === '/'
  const parentAnnotation = instance.annotations[CORE_ANNOTATIONS.PARENT]

  if (parentAnnotation === undefined) {
    if (!isTopLevelFolderPath) {
      return {
        error: {
          message: missingParentMessage,
          detailedMessage: `Parent folder is required (in "${CORE_ANNOTATIONS.PARENT}") `
          + 'when trying to deploy a non top level folder or a file.',
        },
      }
    }
    return {}
  }
  if (isTopLevelFolderPath) {
    return {
      error: {
        message: parentMismatchMessage,
        detailedMessage: `Top level folder should not have a "${CORE_ANNOTATIONS.PARENT}" annotation. `
        + `Change the folder path to a non top level folder path or remove the "${CORE_ANNOTATIONS.PARENT}" annotation.`,
      },
    }
  }
  if (!Array.isArray(parentAnnotation) || parentAnnotation.length !== 1) {
    return {
      error: {
        message: missingParentMessage,
        detailedMessage: `The "${CORE_ANNOTATIONS.PARENT}" annotation should be a list with one item.`,
      },
    }
  }
  const [parentRef] = parentAnnotation
  if (
    !isReferenceExpression(parentRef)
    || !isInstanceElement(parentRef.topLevelParent)
    || parentRef.elemID.typeName !== FOLDER
  ) {
    return {
      error: {
        message: missingParentMessage,
        detailedMessage: `Parent folder (in "${CORE_ANNOTATIONS.PARENT}") must be a reference to a folder`
        + `${typeof parentRef === 'string' ? ' , and not a path' : ''}. `
        + 'Make sure that the parent folder is included in the fetch config, then fetch, '
        + 'then try to deploy again.',
      },
    }
  }
  if (parentDirectory !== parentRef.topLevelParent.value[PATH]) {
    return {
      error: {
        message: parentMismatchMessage,
        detailedMessage: `The path folder (${parentDirectory}) doesn't match the path of the folder in `
        + `"${CORE_ANNOTATIONS.PARENT}" (${parentRef.topLevelParent.value[PATH]}).`,
      },
    }
  }
  const internalId = parentRef.topLevelParent.value[INTERNAL_ID]
  if (internalId === undefined) {
    if (addedFolders && !addedFolders.has(parentDirectory)) {
      return {
        error: {
          message: missingParentMessage,
          detailedMessage: `The parent folder (in "${CORE_ANNOTATIONS.PARENT}") has no intenal ID. `
          + 'Try fetching and deploying again.',
        },
      }
    }
    return {}
  }
  return { id: parseInt(internalId, 10) }
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const [additionChanges, removalsOrModifications] = _.partition(changes, isAdditionChange)

  const addedFolders = new Set(
    additionChanges
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FOLDER)
      .map(instance => instance.value[PATH])
  )

  const parentFolderChangeErrors = additionChanges
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .map(instance => ({ instance, ...getParentInternalId(instance, addedFolders) }))
    .filter(({ error }) => error !== undefined)
    .map(({ instance, error }): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: error?.message ?? '',
      detailedMessage: error?.detailedMessage ?? '',
    }))

  const missingInternalIdChangeErrors = removalsOrModifications
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .filter(instance => instance.value[INTERNAL_ID] === undefined)
    .map((instance): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Missing FileCabinet item ID',
      detailedMessage: 'This FileCabinet instance has no intenal ID. '
      + 'Try fetching and deploying again, or edit it in Netsuite UI.',
    }))

  return parentFolderChangeErrors.concat(missingInternalIdChangeErrors)
}

export default changeValidator
