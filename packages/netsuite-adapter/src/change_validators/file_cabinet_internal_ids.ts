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
import _ from 'lodash'
import path from 'path'
import { values } from '@salto-io/lowerdash'
import {
  ChangeError,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { FILE_CABINET_PATH_SEPARATOR, FOLDER, INTERNAL_ID, PATH } from '../constants'
import { isFileCabinetInstance } from '../types'
import { NetsuiteChangeValidator } from './types'

const HELP_MESSAGE = 'Please see https://help.salto.io/en/articles/7876750-deploying-file-cabinet for more information.'

export const getParentInternalId = (
  instance: InstanceElement,
  addedFolders?: Set<string>,
): { id?: number; error?: ChangeError } => {
  const parentDirectory = path.dirname(instance.value[PATH])
  const isTopLevelFolderPath = parentDirectory === FILE_CABINET_PATH_SEPARATOR
  const parentAnnotation = instance.annotations[CORE_ANNOTATIONS.PARENT]

  if (parentAnnotation === undefined) {
    if (!isTopLevelFolderPath) {
      return {
        error: {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Missing a reference to the parent folder',
          detailedMessage:
            `The parent folder (under '${CORE_ANNOTATIONS.PARENT}') is required` +
            ` when trying to deploy a non-top-level folder or file. ${HELP_MESSAGE}`,
        },
      }
    }
    return {}
  }
  if (isTopLevelFolderPath) {
    return {
      error: {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Mismatch between the path folder and the '${CORE_ANNOTATIONS.PARENT}'`,
        detailedMessage:
          'Top-level folders should not have a parent.' +
          ` Change the folder path to a non-top-level folder path or remove the '${CORE_ANNOTATIONS.PARENT}'. ${HELP_MESSAGE}`,
      },
    }
  }
  if (!Array.isArray(parentAnnotation) || parentAnnotation.length !== 1) {
    return {
      error: {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Invalid '${CORE_ANNOTATIONS.PARENT}'`,
        detailedMessage: `'${CORE_ANNOTATIONS.PARENT}' should be a list of one item. ${HELP_MESSAGE}`,
      },
    }
  }
  const [parentRef] = parentAnnotation
  if (
    !isReferenceExpression(parentRef) ||
    !isInstanceElement(parentRef.topLevelParent) ||
    parentRef.elemID.typeName !== FOLDER
  ) {
    return {
      error: {
        elemID: instance.elemID,
        severity: 'Error',
        message: "Can't resolve the reference to the parent folder",
        detailedMessage: `The parent folder (under '${CORE_ANNOTATIONS.PARENT}') must be a valid reference to a folder${
          typeof parentRef === 'string' ? ' - not a path' : ''
        }. Include the parent folder in the environment configuration, then fetch and deploy again. ${HELP_MESSAGE}`,
      },
    }
  }
  if (parentDirectory !== parentRef.topLevelParent.value[PATH]) {
    return {
      error: {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Mismatch between the path folder and the '${CORE_ANNOTATIONS.PARENT}'`,
        detailedMessage:
          `The path folder (${parentDirectory}) doesn't match the path of the` +
          ` '${CORE_ANNOTATIONS.PARENT}' (${parentRef.topLevelParent.value[PATH]}). ${HELP_MESSAGE}`,
      },
    }
  }
  const internalId = parentRef.topLevelParent.value[INTERNAL_ID]
  if (internalId === undefined) {
    if (addedFolders && !addedFolders.has(parentDirectory)) {
      return {
        error: {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Invalid parent folder',
          detailedMessage:
            `The parent folder (under '${CORE_ANNOTATIONS.PARENT}') is missing its internal ID.` +
            ` Fetch and deploy again. ${HELP_MESSAGE}`,
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
      .map(instance => instance.value[PATH]),
  )

  const parentFolderChangeErrors = additionChanges
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .map(instance => getParentInternalId(instance, addedFolders).error)
    .filter(values.isDefined)

  const missingInternalIdChangeErrors = removalsOrModifications
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .filter(instance => instance.value[INTERNAL_ID] === undefined)
    .map(
      (instance): ChangeError => ({
        elemID: instance.elemID,
        severity: 'Error',
        message: `Invalid FileCabinet ${instance.elemID.typeName}`,
        detailedMessage:
          `This FileCabinet ${instance.elemID.typeName} is missing its internal ID.` +
          ` Fetch and deploy again, or edit it in Netsuite UI. ${HELP_MESSAGE}`,
      }),
    )

  return parentFolderChangeErrors.concat(missingInternalIdChangeErrors)
}

export default changeValidator
