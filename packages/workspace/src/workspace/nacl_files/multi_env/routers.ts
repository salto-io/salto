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
import { getChangeElement, ElemID, Value, DetailedChange, ChangeDataType } from '@salto-io/adapter-api'
import _ from 'lodash'
import path from 'path'
import { promises } from '@salto-io/lowerdash'
import { resolvePath, filterByID, detailedCompare } from '@salto-io/adapter-utils'
import { ElementsSource } from '../../elements_source'
import {
  projectChange, projectElementOrValueToEnv, createAddChange, createRemoveChange,
} from './projections'
import { wrapAdditions, DetailedAddition, wrapNestedValues } from '../addition_wrapper'
import { NaclFilesSource, FILE_EXTENSION, RoutingMode } from '../nacl_files_source'
import { mergeElements } from '../../../merger'

export interface RoutedChanges {
    primarySource?: DetailedChange[]
    commonSource?: DetailedChange[]
    secondarySources?: Record<string, DetailedChange[]>
}

const filterByFile = async (
  valueID: ElemID,
  value: Value,
  filename: string,
  source: NaclFilesSource
): Promise<Value> => filterByID(
  valueID,
  value,
  async id => !_.isEmpty((await source.getElements(filename))
    .filter(e => resolvePath(e, id) !== undefined))
)

const separateChangeByFiles = async (
  change: DetailedChange,
  source: NaclFilesSource
): Promise<DetailedChange[]> => Promise.all(
  (await source.getSourceRanges(change.id))
    .map(range => range.filename)
    .map(async filename => {
      const pathHint = _.trimEnd(filename, FILE_EXTENSION).split(path.sep)
      if (change.action === 'add') {
        return {
          ...change,
          path: pathHint,
          data: {
            after: await filterByFile(change.id, change.data.after, filename, source),
          },
        }
      }
      if (change.action === 'remove') {
        return {
          ...change,
          path: pathHint,
          data: {
            before: await filterByFile(change.id, change.data.before, filename, source),
          },
        }
      }
      return {
        ...change,
        path: pathHint,
        data: {
          before: await filterByFile(change.id, change.data.before, filename, source),
          after: await filterByFile(change.id, change.data.after, filename, source),
        },
      }
    })
)

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

export const routeOverride = async (
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
    if (_.some(secondaryProjections)) {
      return { primarySource: [change] }
    }
    if (change.id.isTopLevel()) {
      return { commonSource: [change] }
    }
    // This is a new value / field / annotation addition. In this case, we will want to
    // add it to common *unless* the entire element is env specific
    const commonTopLevelElement = await commonSource.get(change.id.createTopLevelParentID().parent)
    return commonTopLevelElement ? { commonSource: [change] } : { primarySource: [change] }
  }
  // We add to the current defining source.
  const currentChanges = await projectChange(change, primarySource)
  const commonChanges = await projectChange(change, commonSource)
  return {
    primarySource: currentChanges,
    commonSource: commonChanges,
  }
}

export const routeAlign = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
): Promise<RoutedChanges> => {
  // All add changes to the current active env specific folder
  if (change.action === 'add') {
    return { primarySource: [change] }
  }
  // We drop the common projection of the change
  const currentChanges = await projectChange(change, primarySource)
  return {
    primarySource: currentChanges,
    commonSource: [],
  }
}

export const routeDefault = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>
): Promise<RoutedChanges> => {
  // All add changes to the current active env specific folder unless
  // sec sources are empty - we only have 1 env so adds should go to common.
  // However - if we have only one env and the user moved the top level element to be
  // env specific - we respect that and add the change to the env.
  if (change.action === 'add') {
    const primTopLevelElement = await primarySource.get(change.id.createTopLevelParentID().parent)
    return _.isEmpty(secondarySources) && primTopLevelElement === undefined
      ? { commonSource: [change] }
      : { primarySource: [change] }
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
  const refFilename = (await commonSource.getSourceRanges(change.id))
    .map(sourceRange => sourceRange.filename)[0]

  return refFilename
    ? _.trimEnd(refFilename, FILE_EXTENSION).split(path.sep)
    : undefined
}

export const routeIsolated = async (
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
  const modifyWithCommonProj = change.action === 'modify' && !_.isUndefined(commonChangeProjection)
  const addCommonProjectionToCurrentChanges = modifyWithCommonProj
    ? await projectChange(
      createAddChange(commonChangeProjection, change.id, pathHint),
      primarySource
    ) : []
  // Add the old value of common to the inactive sources
  const secondaryChanges = _.fromPairs(
    await Promise.all(
      _.entries(secondarySources)
        .map(async ([name, source]) => [
          name,
          _.flatten(
            await Promise.all(
              (await projectChange(
                createAddChange(currentCommonElement, change.id, pathHint), source
              )
              ).map(projectedChange => separateChangeByFiles(projectedChange, commonSource))
            )
          ),
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
  const changes = mode === 'isolated'
    ? await toMergeableChanges(rawChanges, primarySource, commonSource)
    : rawChanges

  const routedChanges = await Promise.all(changes.map(c => {
    switch (mode) {
      case 'isolated': return routeIsolated(c, primarySource, commonSource, secondarySources)
      case 'align': return routeAlign(c, primarySource)
      case 'override': return routeOverride(c, primarySource, commonSource, secondarySources)
      default: return routeDefault(c, primarySource, commonSource, secondarySources)
    }
  }))

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

const overrideIdInSource = (
  id: ElemID,
  before: ChangeDataType,
  topLevelElement: ChangeDataType,
): DetailedChange[] => {
  if (id.isTopLevel()) {
    return detailedCompare(before, topLevelElement, true)
  }

  const afterValue = resolvePath(topLevelElement, id)
  const beforeValue = resolvePath(before, id)
  if (beforeValue === undefined) {
    // Nothing to override, just need to add the new value
    return [createAddChange(afterValue, id)]
  }
  // The value exists in the target - override only the relevant part
  return detailedCompare(
    wrapNestedValues([{ id, value: beforeValue }], before) as ChangeDataType,
    wrapNestedValues([{ id, value: afterValue }], topLevelElement) as ChangeDataType,
    true,
  )
}

const addToSource = async ({
  ids,
  originSource,
  targetSource,
  overrideTargetElements = false,
}: {
  ids: ElemID[]
  originSource: NaclFilesSource
  targetSource: NaclFilesSource
  overrideTargetElements?: boolean
}): Promise<DetailedChange[]> => {
  const idsByParent = _.groupBy(ids, id => id.createTopLevelParentID().parent.getFullName())
  const fullChanges = _.flatten(await Promise.all(Object.values(idsByParent).map(async gids => {
    const topLevelElement = await originSource.get(gids[0].createTopLevelParentID().parent)
    if (topLevelElement === undefined) {
      throw new Error(`ElemID ${gids[0].getFullName()} does not exist in origin`)
    }
    const topLevelIds = gids.filter(id => id.isTopLevel())
    const wrappedElement = !_.isEmpty(topLevelIds)
      ? topLevelElement
      : wrapNestedValues(
        gids.map(id => ({ id, value: resolvePath(topLevelElement, id) })),
        topLevelElement
      )
    const before = await targetSource.get(topLevelElement.elemID)
    if (before === undefined) {
      return [createAddChange(wrappedElement, topLevelElement.elemID)]
    }

    if (overrideTargetElements) {
      // we want to override, not merge - so we need to wrap each gid individually
      return gids.flatMap(id => overrideIdInSource(
        id,
        before as ChangeDataType,
        topLevelElement as ChangeDataType,
      ))
    }

    const mergeResult = mergeElements([
      before,
      wrappedElement,
    ])
    if (mergeResult.errors.length > 0) {
      // If either the origin or the target source is the common folder, all elements should be
      // mergeable and we shouldn't see merge errors
      throw new Error(
        `Failed to add ${gids.map(id => id.getFullName())} - unmergable element fragments.`
      )
    }
    const after = mergeResult.merged[0] as ChangeDataType
    return detailedCompare(before, after, true)
  })))
  return (await Promise.all(fullChanges.map(change => separateChangeByFiles(
    change,
    change.action === 'remove' ? targetSource : originSource
  )))).flat()
}

const removeFromSource = async (
  ids: ElemID[],
  targetSource: NaclFilesSource
): Promise<DetailedChange[]> => {
  const targetTopLevelElement = await targetSource.get(ids[0].createTopLevelParentID().parent)
  if (targetTopLevelElement === undefined) {
    return []
  }
  return ids.map(id => createRemoveChange(resolvePath(targetTopLevelElement, id), id))
}

export const routePromote = async (
  ids: ElemID[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => ({
  primarySource: await removeFromSource(ids, primarySource),
  commonSource: await addToSource({ ids, originSource: primarySource, targetSource: commonSource }),
  secondarySources: await promises.object.mapValuesAsync(
    secondarySources,
    (source: NaclFilesSource) => removeFromSource(ids, source)
  ),
})

export const routeDemote = async (
  ids: ElemID[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => ({
  primarySource: await addToSource({
    ids,
    originSource: commonSource,
    targetSource: primarySource,
  }),
  commonSource: await removeFromSource(ids, commonSource),
  secondarySources: await promises.object.mapValuesAsync(
    secondarySources,
    (source: NaclFilesSource) => addToSource({
      ids,
      originSource: commonSource,
      targetSource: source,
    })
  ),
})

export const routeCopyTo = async (
  ids: ElemID[],
  primarySource: NaclFilesSource,
  targetSources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => ({
  primarySource: [],
  commonSource: [],
  secondarySources: await promises.object.mapValuesAsync(
    targetSources,
    (source: NaclFilesSource) => addToSource({
      ids,
      originSource: primarySource,
      targetSource: source,
      overrideTargetElements: true,
    })
  ),
})
