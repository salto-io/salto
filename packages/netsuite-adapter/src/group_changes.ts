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
import wu from 'wu'
import {
  Change, ChangeGroupIdFunction, ChangeId, getChangeData, isAdditionChange,
  isInstanceElement, isModificationChange, isObjectType, isReferenceExpression,
  isField, isRemovalChange, Element, isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import _ from 'lodash'
import * as suiteAppFileCabinet from './suiteapp_file_cabinet'
import { isSuiteAppConfigInstance, isSDFConfigTypeName, isDataObjectType, isFileCabinetInstance, isStandardInstanceOrCustomRecordType, isCustomRecordType } from './types'
import { APPLICATION_ID } from './constants'
import { isPathAllowedBySdf } from './types/file_cabinet_types'

const { awu } = collections.asynciterable

export const SDF_CREATE_OR_UPDATE_GROUP_ID = 'SDF - create or update'
export const SDF_DELETE_GROUP_ID = 'SDF - Delete'
export const SUITEAPP_CREATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Creating Files'
export const SUITEAPP_UPDATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Updating Files'
export const SUITEAPP_DELETING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Deleting Files'
export const SUITEAPP_CREATING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Creating Records'
export const SUITEAPP_UPDATING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Updating Records'
export const SUITEAPP_DELETING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Deleting Records'
export const SUITEAPP_UPDATING_CONFIG_GROUP_ID = 'Salto SuiteApp - Updating Config'

export const isSdfCreateOrUpdateGroupId = (groupId: string): boolean =>
  groupId.startsWith(SDF_CREATE_OR_UPDATE_GROUP_ID)

export const isSdfDeleteGroupId = (groupId: string): boolean =>
  groupId.startsWith(SDF_DELETE_GROUP_ID)

export const isSuiteAppCreateRecordsGroupId = (groupId: string): boolean =>
  groupId.startsWith(SUITEAPP_CREATING_RECORDS_GROUP_ID)

export const isSuiteAppUpdateRecordsGroupId = (groupId: string): boolean =>
  groupId.startsWith(SUITEAPP_UPDATING_RECORDS_GROUP_ID)

export const isSuiteAppDeleteRecordsGroupId = (groupId: string): boolean =>
  groupId.startsWith(SUITEAPP_DELETING_RECORDS_GROUP_ID)

export const isSuiteAppUpdateConfigGroupId = (groupId: string): boolean =>
  groupId.startsWith(SUITEAPP_UPDATING_CONFIG_GROUP_ID)

export const SUITEAPP_FILE_CABINET_GROUPS = [
  SUITEAPP_CREATING_FILES_GROUP_ID,
  SUITEAPP_UPDATING_FILES_GROUP_ID,
  SUITEAPP_DELETING_FILES_GROUP_ID,
]

const getSdfWithSuiteAppGroupName = (change: Change): string => {
  const element = getChangeData(change)
  if (isInstanceElement(element) && element.value[APPLICATION_ID] !== undefined) {
    return `${SDF_CREATE_OR_UPDATE_GROUP_ID} - ${element.value[APPLICATION_ID]}`
  }
  if (isObjectType(element) && element.annotations[APPLICATION_ID] !== undefined) {
    return `${SDF_CREATE_OR_UPDATE_GROUP_ID} - ${element.annotations[APPLICATION_ID]}`
  }
  if (isField(element) && element.parent.annotations[APPLICATION_ID] !== undefined) {
    return `${SDF_CREATE_OR_UPDATE_GROUP_ID} - ${element.parent.annotations[APPLICATION_ID]}`
  }
  return SDF_CREATE_OR_UPDATE_GROUP_ID
}

const getChangeGroupIdsWithoutSuiteApp: ChangeGroupIdFunction = async changes => {
  const isSdfChange = (change: Change): boolean => {
    const changeData = getChangeData(change)
    return isAdditionOrModificationChange(change)
      && (isStandardInstanceOrCustomRecordType(changeData)
      || (isFileCabinetInstance(changeData) && isPathAllowedBySdf(changeData))
      || isSDFConfigTypeName(changeData.elemID.typeName))
  }
  return {
    changeGroupIdMap: new Map(
      wu(changes.entries())
        .filter(([_id, change]) => isSdfChange(change))
        .map(([id, change]) => [id, getSdfWithSuiteAppGroupName(change)])
    ),
  }
}

const getRecordDependencies = (element: Element): string[] => {
  const dependencies: string[] = []
  walkOnElement({
    element,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (isReferenceExpression(value)) {
        dependencies.push(value.elemID.getFullName())
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return dependencies
}

const getChangesChunks = async (
  changes: { change: Change; id: ChangeId }[],
  groupID: string,
) : Promise<ChangeId[][]> => {
  if (SUITEAPP_CREATING_RECORDS_GROUP_ID !== groupID) {
    return [changes.map(({ id }) => id)]
  }

  const changesChunks: ChangeId[][] = [[]]
  const iteratedIds: Set<string> = new Set()
  await awu(changes)
    .forEach(async change => {
      const data = getChangeData(change.change)
      const dependencies = getRecordDependencies(data)
      if (dependencies.some(dependency => iteratedIds.has(dependency))) {
        changesChunks.push([])
        iteratedIds.clear()
      }
      changesChunks[changesChunks.length - 1].push(change.id)
      iteratedIds.add(data.elemID.getFullName())
    })

  return changesChunks
}

const isSuiteAppFileCabinetModification = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isFileCabinetInstance(changeData)
  && await suiteAppFileCabinet.isChangeDeployable(change)
  && isModificationChange(change)
}

const isSuiteAppFileCabinetAddition = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isFileCabinetInstance(changeData)
  && await suiteAppFileCabinet.isChangeDeployable(change)
  && isAdditionChange(change)
}

const isSuiteAppFileCabinetDeletion = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isFileCabinetInstance(changeData)
  && await suiteAppFileCabinet.isChangeDeployable(change)
  && isRemovalChange(change)
}

const isSdfCreateOrUpdate = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isAdditionOrModificationChange(change)
    && (
      isStandardInstanceOrCustomRecordType(changeData)
    || (isFileCabinetInstance(changeData) && !await suiteAppFileCabinet.isChangeDeployable(change))
    || isSDFConfigTypeName(changeData.elemID.typeName)
    )
}

const isSdfDelete = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isRemovalChange(change) && isStandardInstanceOrCustomRecordType(changeData)
}

const isSuiteAppRecordChange = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  if (!isInstanceElement(changeData)) {
    return false
  }
  const type = await changeData.getType()
  return isDataObjectType(type) || isCustomRecordType(type)
}

const isSuiteAppRecordAddition = async (change: Change): Promise<boolean> =>
  await isSuiteAppRecordChange(change)
  && isAdditionChange(change)

const isSuiteAppRecordModification = async (change: Change): Promise<boolean> =>
  await isSuiteAppRecordChange(change)
  && isModificationChange(change)

const isSuiteAppRecordDeletion = async (change: Change): Promise<boolean> =>
  await isSuiteAppRecordChange(change)
  && isRemovalChange(change)

const isSuiteAppConfigChange = async (change: Change): Promise<boolean> => {
  const changeData = getChangeData(change)
  return isInstanceElement(changeData) && isSuiteAppConfigInstance(changeData)
}

const getChangeGroupIdsWithSuiteApp: ChangeGroupIdFunction = async changes => {
  const conditionsToGroups = [
    { condition: isSuiteAppFileCabinetAddition, group: SUITEAPP_CREATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetModification, group: SUITEAPP_UPDATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetDeletion, group: SUITEAPP_DELETING_FILES_GROUP_ID },
    { condition: isSuiteAppRecordAddition, group: SUITEAPP_CREATING_RECORDS_GROUP_ID },
    { condition: isSuiteAppRecordModification, group: SUITEAPP_UPDATING_RECORDS_GROUP_ID },
    { condition: isSuiteAppRecordDeletion, group: SUITEAPP_DELETING_RECORDS_GROUP_ID },
    { condition: isSuiteAppConfigChange, group: SUITEAPP_UPDATING_CONFIG_GROUP_ID },
    { condition: isSdfCreateOrUpdate, group: SDF_CREATE_OR_UPDATE_GROUP_ID },
    { condition: isSdfDelete, group: SDF_DELETE_GROUP_ID },
  ]

  const changesWithGroups = await awu(changes.entries())
    .map(async ([id, change]) => {
      const group = (await awu(conditionsToGroups).find(
        ({ condition }) => condition(change)
      ))?.group

      return group !== undefined ? { change, id, group } : undefined
    })
    .filter(values.isDefined)
    .map(change => ({
      ...change,
      group: change.group === SDF_CREATE_OR_UPDATE_GROUP_ID
        ? getSdfWithSuiteAppGroupName(change.change)
        : change.group,
    }))
    .toArray()

  const groupToChanges = _.groupBy(changesWithGroups, ({ group }) => group)

  const groups = await awu(Object.entries(groupToChanges))
    .flatMap(async ([groupId, groupChanges]) => {
      const chunks = await getChangesChunks(groupChanges, groupId)
      return chunks.length === 1
        ? chunks[0].map((id):[collections.set.SetId, string] => [id, groupId])
        : chunks.map((chunk, i): [collections.set.SetId, string][] => chunk.map(id => [id, `${groupId} - ${i + 1}/${chunks.length}`])).flat()
    }).toArray()

  return { changeGroupIdMap: new Map(groups) }
}

export const getChangeGroupIdsFunc = (isSuiteAppConfigured: boolean): ChangeGroupIdFunction =>
  async changes => (isSuiteAppConfigured
    ? getChangeGroupIdsWithSuiteApp(changes)
    : getChangeGroupIdsWithoutSuiteApp(changes))
