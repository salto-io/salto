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
  Change, ChangeGroupIdFunction, ChangeId, getChangeElement, InstanceElement, isAdditionChange,
  isInstanceChange, isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import * as suiteAppFileCabinet from './suiteapp_file_cabinet'
import { customTypes, fileCabinetTypes, isDataObjectType, isFileCabinetInstance } from './types'

const { awu } = collections.asynciterable

export const SDF_CHANGE_GROUP_ID = 'SDF'
export const SUITEAPP_CREATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Creating Files'
export const SUITEAPP_UPDATING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Updating Files'
export const SUITEAPP_DELETING_FILES_GROUP_ID = 'Salto SuiteApp - File Cabinet - Deleting Files'
export const SUITEAPP_CREATING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Creating Records'
export const SUITEAPP_UPDATING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Updating Records'
export const SUITEAPP_DELETING_RECORDS_GROUP_ID = 'Salto SuiteApp - Records - Deleting Records'

export const SUITEAPP_FILE_CABINET_GROUPS = [
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

const getRecordDependencies = async (element: InstanceElement): Promise<string[]> => {
  const dependencies: string[] = []
  await transformValues({
    values: element.value,
    type: await element.getType(),
    strict: false,
    transformFunc: ({ value }) => {
      if (isReferenceExpression(value)) {
        dependencies.push(value.elemID.getFullName())
      }
      return value
    },
  })
  return dependencies
}

const getChangesChunks = async (
  changes: { change: Change; id: ChangeId }[],
  groupID: string,
)
: Promise<ChangeId[][]> => {
  if (SUITEAPP_CREATING_RECORDS_GROUP_ID !== groupID) {
    return [changes.map(({ id }) => id)]
  }

  const changesChunks: ChangeId[][] = [[]]
  const iteratedIds: Set<string> = new Set()
  await awu(changes)
    .filter(change => isInstanceChange(change.change))
    .forEach(async change => {
      const dependencies = await getRecordDependencies(
        getChangeElement(change.change as Change<InstanceElement>)
      )
      if (dependencies.some(dependency => iteratedIds.has(dependency))) {
        changesChunks.push([])
        iteratedIds.clear()
      }
      changesChunks[changesChunks.length - 1].push(change.id)
      iteratedIds.add(getChangeElement(change.change).elemID.getFullName())
    })

  return changesChunks
}

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

const isSuiteAppRecordChange = async (change: Change): Promise<boolean> => {
  const changeElement = getChangeElement(change)
  return isInstanceElement(changeElement)
  && isDataObjectType(await changeElement.getType())
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

const getChangeGroupIdsWithSuiteApp: ChangeGroupIdFunction = async changes => {
  const conditionsToGroups = [
    { condition: isSuiteAppFileCabinetAddition, group: SUITEAPP_CREATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetModification, group: SUITEAPP_UPDATING_FILES_GROUP_ID },
    { condition: isSuiteAppFileCabinetDeletion, group: SUITEAPP_DELETING_FILES_GROUP_ID },
    { condition: isSuiteAppRecordAddition, group: SUITEAPP_CREATING_RECORDS_GROUP_ID },
    { condition: isSuiteAppRecordModification, group: SUITEAPP_UPDATING_RECORDS_GROUP_ID },
    { condition: isSuiteAppRecordDeletion, group: SUITEAPP_DELETING_RECORDS_GROUP_ID },
    { condition: isSdfChange, group: SDF_CHANGE_GROUP_ID },
  ]

  const changesWithGroups = await awu(changes.entries())
    .map(async ([id, change]) => {
      const group = (await awu(conditionsToGroups).find(
        ({ condition }) => condition(change)
      ))?.group
      return group !== undefined ? { change, id, group } : undefined
    })
    .filter(values.isDefined)
    .toArray()

  const groupToChanges = _.groupBy(changesWithGroups, ({ group }) => group)

  const groups = await awu(Object.entries(groupToChanges))
    .flatMap(async ([groupId, groupChanges]) => {
      const chunks = await getChangesChunks(groupChanges, groupId)
      return chunks.length === 1
        ? chunks[0].map((id):[collections.set.SetId, string] => [id, groupId])
        : chunks.map((chunk, i): [collections.set.SetId, string][] => chunk.map(id => [id, `${groupId} - ${i + 1}/${chunks.length}`])).flat()
    }).toArray()

  return new Map(groups)
}

export const getChangeGroupIdsFunc = (isSuiteAppConfigured: boolean): ChangeGroupIdFunction =>
  async changes => (isSuiteAppConfigured
    ? getChangeGroupIdsWithSuiteApp(changes)
    : getChangeGroupIdsWithoutSuiteApp(changes))
