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
import wu from 'wu'
import {
  Change, ChangeGroupIdFunction, ChangeId, getChangeElement, isAdditionChange, isInstanceElement,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import * as suiteAppFileCabinet from './suiteapp_file_cabinet'
import { customTypes, fileCabinetTypes, isFileCabinetInstance } from './types'

export const SDF_CHANGE_GROUP_ID = 'SDF'
export const SUITEAPP_CREATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Creating Files'
export const SUITEAPP_UPDATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Updating Files'
export const SUITEAPP_DELETING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Deleting Files'

export const SUITEAPP_GROUPS = [
  SUITEAPP_CREATING_FILES_GROUP_ID,
  SUITEAPP_UPDATING_FILES_GROUP_ID,
  SUITEAPP_DELETING_FILES_GROUP_ID,
]

const getChangeGroupIdsWithoutSuiteApp: ChangeGroupIdFunction = async changes => {
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

const getChangeGroupIdsWithSuiteApp: ChangeGroupIdFunction = async changes => {
  const isSuiteAppFileCabinetModification = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isFileCabinetInstance(changeElement)
    && suiteAppFileCabinet.isChangeDeployable(change)
    && isModificationChange(change)
  }

  const isSuiteAppFileCabinetAddition = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isFileCabinetInstance(changeElement)
    && suiteAppFileCabinet.isChangeDeployable(change)
    && isAdditionChange(change)
  }

  const isSuiteAppFileCabinetDeletion = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isFileCabinetInstance(changeElement)
    && suiteAppFileCabinet.isChangeDeployable(change)
    && isRemovalChange(change)
  }

  const isSdfChange = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return Object.keys(customTypes).includes(changeElement.elemID.typeName)
      || (isFileCabinetInstance(changeElement)
        && !suiteAppFileCabinet.isChangeDeployable(change))
  }

  const conditionsToGroups = [
    { condition: isSuiteAppFileCabinetAddition, group: SUITEAPP_CREATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetModification, group: SUITEAPP_UPDATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetDeletion, group: SUITEAPP_DELETING_FILES_GROUP_ID },
    { condition: isSdfChange, group: SDF_CHANGE_GROUP_ID },
  ]

  return new Map(
    wu(changes.entries())
      .map(([id, change]): undefined | [ChangeId, string] => {
        const group = conditionsToGroups.find(({ condition }) => condition(change))?.group
        return group !== undefined ? [id, group] : undefined
      })
      .filter(values.isDefined)
  )
}

export const getChangeGroupIdsFunc = (isSuiteAppConfigured: boolean): ChangeGroupIdFunction =>
  async changes => (isSuiteAppConfigured
    ? getChangeGroupIdsWithSuiteApp(changes)
    : getChangeGroupIdsWithoutSuiteApp(changes))
