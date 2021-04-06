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
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import * as suiteAppFileCabinet from './suiteapp_file_cabinet'
import { customTypes, fileCabinetTypes, isFileCabinetType } from './types'

export const SDF_CHANGE_GROUP_ID = 'SDF'

export const SDF_GROUPS = [SDF_CHANGE_GROUP_ID, 'Records', 'SDF - File Cabinet']

export const SUITEAPP_CREATING_FILES = 'Salto SuiteApp - File Cabinet - Creating Files'
export const SUITEAPP_GROUPS = [SUITEAPP_CREATING_FILES, 'Salto SuiteApp - File Cabinet - Updating Files']

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
  const isRecordChange = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isInstanceElement(changeElement)
    && Object.keys(customTypes).includes(changeElement.elemID.typeName)
  }

  const isSuiteAppFileCabinetModification = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isInstanceElement(changeElement)
    && isFileCabinetType(changeElement.type)
    && suiteAppFileCabinet.isChangeDeployable(change)
    && isModificationChange(change)
  }

  const isSuiteAppFileCabinetAddition = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isInstanceElement(changeElement)
    && isFileCabinetType(changeElement.type)
    && suiteAppFileCabinet.isChangeDeployable(change)
    && isAdditionChange(change)
  }

  const isSdfFileCabinetChange = (change: Change): boolean => {
    const changeElement = getChangeElement(change)
    return isInstanceElement(changeElement)
    && isFileCabinetType(changeElement.type)
    && !suiteAppFileCabinet.isChangeDeployable(change)
  }

  const conditionsToGroups = [
    { condition: isRecordChange, group: 'Records' },
    { condition: isSuiteAppFileCabinetAddition, group: SUITEAPP_CREATING_FILES },
    { condition: isSuiteAppFileCabinetModification, group: 'Salto SuiteApp - File Cabinet - Updating Files' },
    { condition: isSdfFileCabinetChange, group: 'SDF - File Cabinet' },
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
