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
import { getChangeElement, ElemID } from '@salto-io/adapter-api'
import _ from 'lodash'
import path from 'path'
import { promises } from '@salto-io/lowerdash'
import { ElementsSource } from 'src/workspace/elements_source'
import {
  projectChange, projectElementOrValueToEnv, createAddChange, createRemoveChange,
} from './projections'
import { DetailedChange } from '../../../core/plan'
import { wrapAdditions, DetailedAddition } from '../addition_wrapper'
import { NaclFilesSource, FILE_EXTENSION, RoutingMode } from '../nacl_files_source'

export interface RoutedChanges {
    primarySource?: DetailedChange[]
    commonSource?: DetailedChange[]
    secondarySources?: Record<string, DetailedChange[]>
}

const createUpdateChanges = async (
  changes: DetailedChange[],
  commonSource: ElementsSource,
  targetSource: ElementsSource
): Promise<DetailedChange[]> => {
  const [nestedAdditions, otherChanges] = await promises.array.partition(
    changes,
    async change => (change.action === 'add'
        && change.id.nestingLevel > 0
        && !(await targetSource.get(change.id.createTopLevelParentID().parent)))
  )
  const modifiedAdditions = await Promise.all(_(nestedAdditions)
    .groupBy(addition => addition.id.createTopLevelParentID().parent.getFullName())
    .entries()
    .map(async ([parentID, elementAdditions]) => {
      const commonElement = await commonSource.get(ElemID.fromFullName(parentID))
      const targetElement = await targetSource.get(ElemID.fromFullName(parentID))
      if (commonElement && !targetElement) {
        return wrapAdditions(elementAdditions as DetailedAddition[], commonElement)
      }
      return elementAdditions
    })
    .value())
  return [
    ...otherChanges,
    ..._.flatten(modifiedAdditions),
  ]
}

const getMergeableParentID = (id: ElemID): {mergeableID: ElemID; path: string[]} => {
  const isListPart = (part: string): boolean => !Number.isNaN(Number(part))
  const firstListNamePart = id.getFullNameParts().findIndex(isListPart)
  if (firstListNamePart < 0) return { mergeableID: id, path: [] }
  const mergeableNameParts = id.getFullNameParts().slice(0, firstListNamePart)
  return {
    mergeableID: ElemID.fromFullNameParts(mergeableNameParts),
    path: id.getFullNameParts().slice(firstListNamePart),
  }
}

const createMergeableChange = async (
  changes: DetailedChange[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource
): Promise<DetailedChange> => {
  const refChange = changes[0]
  const { mergeableID } = getMergeableParentID(refChange.id)
  // If the mergeableID is a parent of the change id, we need to create
  // the mergeable change by manualy applying the change to the current
  // existing element.
  const base = await commonSource.get(mergeableID) || await primarySource.get(mergeableID)
  const baseAfter = _.cloneDeep(base)
  changes.forEach(change => {
    const changePath = getMergeableParentID(change.id).path
    if (change.action === 'remove') {
      _.unset(baseAfter, changePath)
    } else {
      _.set(baseAfter, changePath, change.data.after)
    }
  })
  return {
    action: 'modify',
    id: mergeableID,
    path: refChange.path,
    data: {
      before: base,
      after: baseAfter,
    },
  }
}

export const routeFetch = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>
): Promise<RoutedChanges> => {
  // If the add change projects to a secondary source we can't
  // add it to common since it is already marked as env specific.
  if (change.action === 'add') {
    const secondaryProjections = await Promise.all(
      _.values(secondarySources)
        .map(src => projectElementOrValueToEnv(getChangeElement(change), change.id, src))
    )
    return _.some(secondaryProjections)
      ? { primarySource: [change] }
      : { commonSource: [change] }
  }
  // We add to the current defining source.
  const currentChanges = await projectChange(change, primarySource)
  const commonChanges = await projectChange(change, commonSource)
  return {
    primarySource: currentChanges,
    commonSource: commonChanges,
  }
}

const getChangePathHint = async (
  change: DetailedChange,
  commonSource: NaclFilesSource
): Promise<string[] | undefined> => {
  if (change.path) return change.path
  const refFilename = (await commonSource.getElementNaclFiles(change.id))[0]
  return refFilename
    ? _.trimEnd(refFilename, FILE_EXTENSION).split(path.sep)
    : undefined
}

export const routeNewEnv = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>
): Promise<RoutedChanges> => {
  // This is an add change, which means the element is not in common.
  // so we will add it to the current action enviornment.
  const pathHint = await getChangePathHint(change, commonSource)

  if (change.action === 'add') {
    return { primarySource: [change] }
  }

  // In remove and modify changes, we need to remove the current value from
  // common, add it to the inactive envs, and apply the actual change to the
  // active env.
  const changeElement = getChangeElement(change)
  const currentEnvChanges = await projectChange(change, primarySource)
  const commonChangeProjection = await projectElementOrValueToEnv(
    changeElement,
    change.id,
    commonSource
  )
  // If the element is not in common, then we can apply the change to
  // the primary source
  if (_.isUndefined(commonChangeProjection)) {
    return { primarySource: [change] }
  }

  const currentCommonElement = await commonSource.get(change.id)
  // Keeping the parser happy, this will never happen (see above)
  if (_.isUndefined(currentCommonElement)) {
    throw Error('Missing element in common')
  }
  // Add the changed part of common to the target source
  const modifyWithCommonProj = change.action === 'modify' && commonChangeProjection
  const addCommonProjectionToCurrentChanges = modifyWithCommonProj
    ? await projectChange(
      createAddChange(commonChangeProjection, change.id, pathHint),
      primarySource
    )
    : []
  // Add the old value of common to the inactive sources
  const secondaryChanges = _.fromPairs(
    await Promise.all(
      _.entries(secondarySources)
        .map(async ([name, source]) => [
          name,
          await projectChange(createAddChange(currentCommonElement, change.id, pathHint), source),
        ])
    )
  )
  return {
    primarySource: [...currentEnvChanges, ...addCommonProjectionToCurrentChanges],
    commonSource: [createRemoveChange(commonChangeProjection, change.id, pathHint)],
    secondarySources: secondaryChanges,
  }
}

const partitionMergeableChanges = async (
  changes: DetailedChange[],
  commonSource: NaclFilesSource
): Promise<[DetailedChange[], DetailedChange[]]> => (
  promises.array.partition(
    changes,
    async change => {
      const { mergeableID } = getMergeableParentID(change.id)
      return !_.isEqual(change.id, mergeableID)
        && !_.isUndefined(await commonSource.get(mergeableID))
    }
  )
)

const toMergeableChanges = async (
  changes: DetailedChange[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
): Promise<DetailedChange[]> => {
  // First we create mergeable changes!
  // We need to modify a change iff:
  // 1) It has a common projection
  // 2) It is inside an array
  const [nonMergeableChanges, mergeableChanges] = await partitionMergeableChanges(
    changes,
    commonSource
  )
  return [
    ...mergeableChanges,
    ...await Promise.all(_(nonMergeableChanges)
      .groupBy(c => getMergeableParentID(c.id).mergeableID.getFullName())
      .values()
      .map(c => createMergeableChange(c, primarySource, commonSource))
      .value()),
  ]
}

export const routeChanges = async (
  rawChanges: DetailedChange[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
  mode?: RoutingMode
): Promise<RoutedChanges> => {
  const isIsolated = mode === 'isolated'
  const changes = isIsolated
    ? await toMergeableChanges(rawChanges, primarySource, commonSource)
    : rawChanges
  const routedChanges = await Promise.all(changes.map(c => (isIsolated
    ? routeNewEnv(c, primarySource, commonSource, secondarySources)
    : routeFetch(c, primarySource, commonSource, secondarySources))))
  const secondaryEnvsChanges = _.mergeWith(
    {},
    ...routedChanges.map(r => r.secondarySources || {}),
    (objValue: DetailedChange[], srcValue: DetailedChange[]) => (
      objValue ? [...objValue, ...srcValue] : srcValue
    )
  ) as Record<string, DetailedChange[]>
  return {
    primarySource: await createUpdateChanges(
      _.flatten(routedChanges.map(r => r.primarySource || [])),
      commonSource,
      primarySource
    ),
    commonSource: await createUpdateChanges(
      _.flatten(routedChanges.map(r => r.commonSource || [])),
      commonSource,
      commonSource
    ),
    secondarySources: await promises.object.mapValuesAsync(
      secondaryEnvsChanges,
      (srcChanges, srcName) => createUpdateChanges(
        srcChanges,
        commonSource,
        secondarySources[srcName]
      )
    ),
  }
}
