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
  ChangeDataType,
  DetailedChange,
  Element,
  ElemID,
  getChangeData,
  isAdditionChange,
  isField,
  isIndexPathPart,
  isInstanceElement,
  isObjectType,
  isPrimitiveType,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, promises, values } from '@salto-io/lowerdash'
import {
  applyDetailedChanges,
  applyFunctionToChangeData,
  detailedCompare,
  FILTER_FUNC_NEXT_STEP,
  filterByID,
  resolvePath,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createAddChange, createRemoveChange, projectChange, projectElementOrValueToEnv } from './projections'
import { DetailedAddition, wrapAdditions, wrapNestedValues } from '../addition_wrapper'
import { NaclFilesSource, RoutingMode, toPathHint } from '../nacl_files_source'
import { mergeElements } from '../../../merger'

const { awu } = collections.asynciterable

const log = logger(module)

export interface RoutedChangesByRole {
  primarySource?: DetailedChange[]
  commonSource?: DetailedChange[]
  secondarySources?: Record<string, DetailedChange[]>
}

export type RoutedChanges = {
  commonSource?: DetailedChange[]
  envSources?: Record<string, DetailedChange[]>
}

// Exported for testing
export const getMergeableParentID = (
  id: ElemID,
  topLevelFragments: Element[],
): { mergeableID: ElemID; path: string[] } => {
  if (id.isTopLevel()) {
    return { mergeableID: id, path: [] }
  }
  const nameParts = id.getFullNameParts()
  for (let i = 1; i < nameParts.length; i += 1) {
    if (isIndexPathPart(nameParts[i])) {
      // Its okay to avoid checking the entire id since we will return it anyways
      const mergeableID = ElemID.fromFullNameParts(nameParts.slice(0, i))
      const valuesAtMergeableID = topLevelFragments.map(elem => resolvePath(elem, mergeableID))
      if (valuesAtMergeableID.some(_.isArray)) {
        return { mergeableID, path: nameParts.slice(i) }
      }
    }
  }
  return { mergeableID: id, path: [] }
}

const filterByFile = async (valueID: ElemID, value: Value, fileElements: Element[]): Promise<Value> => {
  const filterByMergeable = async (id: ElemID): Promise<FILTER_FUNC_NEXT_STEP> => {
    const result = !_.isEmpty(
      fileElements.filter(e => resolvePath(e, getMergeableParentID(id, fileElements).mergeableID) !== undefined),
    )
    if (result) {
      return FILTER_FUNC_NEXT_STEP.RECURSE
    }
    return FILTER_FUNC_NEXT_STEP.EXCLUDE
  }
  return filterByID(valueID, value, filterByMergeable)
}

const isEmptyAnnoAndAnnoTypes = (element: Element): boolean =>
  _.isEmpty(element.annotations) && _.isEmpty(element.annotationRefTypes)

const isEmptyChangeElement = (element: Element): boolean => {
  if (isObjectType(element)) {
    return isEmptyAnnoAndAnnoTypes(element) && _.isEmpty(element.fields)
  }
  if (isPrimitiveType(element)) {
    return isEmptyAnnoAndAnnoTypes(element)
  }
  if (isInstanceElement(element)) {
    return _.isEmpty(element.annotations) && _.isEmpty(element.value)
  }
  if (isField(element)) {
    return _.isEmpty(element.annotations)
  }
  return false
}

const separateChangeByFiles = async (change: DetailedChange, source: NaclFilesSource): Promise<DetailedChange[]> => {
  const isEmptyChangeElm = isEmptyChangeElement(getChangeData(change))
  const elementNaclFiles = await source.getElementNaclFiles(change.id)
  if (_.isEmpty(elementNaclFiles)) {
    return [change]
  }
  const sortedChanges = (
    await Promise.all(
      elementNaclFiles.map(async filename => {
        const fileElements = await awu((await (await source.getParsedNaclFile(filename))?.elements()) || []).toArray()
        const filteredChange = await applyFunctionToChangeData(change, changeData =>
          filterByFile(change.id, changeData, fileElements),
        )
        // annotation types are empty but should still be copied
        if (
          !isEmptyChangeElm &&
          !filteredChange.id.isAnnotationTypeID() &&
          isEmptyChangeElement(getChangeData(filteredChange))
        ) {
          return undefined
        }
        return { ...filteredChange, path: toPathHint(filename) }
      }),
    )
  ).filter(values.isDefined)

  return sortedChanges
}

const overrideIdInSource = (id: ElemID, before: ChangeDataType, topLevelElement: ChangeDataType): DetailedChange[] => {
  if (id.isTopLevel()) {
    return detailedCompare(before, topLevelElement, { createFieldChanges: true })
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
    { createFieldChanges: true },
  )
}

const addToSource = async ({
  ids,
  originSource,
  targetSource,
  overrideTargetElements = false,
  valuesOverrides = {},
}: {
  ids: ElemID[]
  originSource: NaclFilesSource
  targetSource: NaclFilesSource
  overrideTargetElements?: boolean
  valuesOverrides?: Record<string, Value>
}): Promise<DetailedChange[]> =>
  log.timeDebug(async () => {
    const idsByParent = _.groupBy(ids, id => id.createTopLevelParentID().parent.getFullName())
    const fullChanges = await awu(Object.values(idsByParent))
      .flatMap(async gids => {
        const topLevelGid = gids[0].createTopLevelParentID().parent
        const topLevelElement = valuesOverrides[topLevelGid.getFullName()] ?? (await originSource.get(topLevelGid))
        const before = await targetSource.get(topLevelGid)
        if (!values.isDefined(topLevelElement)) {
          if (values.isDefined(before)) {
            return []
          }
          throw new Error(`ElemID ${gids[0].getFullName()} does not exist in origin`)
        }
        const topLevelIds = gids.filter(id => id.isTopLevel())
        const wrappedElement = !_.isEmpty(topLevelIds)
          ? topLevelElement
          : wrapNestedValues(
              gids.map(id => ({
                id,
                value: valuesOverrides[id.getFullName()] ?? resolvePath(topLevelElement, id),
              })),
              topLevelElement,
            )
        if (!values.isDefined(before)) {
          return [createAddChange(wrappedElement, topLevelElement.elemID)]
        }
        if (overrideTargetElements) {
          // we want to override, not merge - so we need to wrap each gid individually
          return gids.flatMap(id => overrideIdInSource(id, before as ChangeDataType, topLevelElement as ChangeDataType))
        }

        const mergeResult = await mergeElements(awu([before, wrappedElement]))
        if (!(await awu(mergeResult.errors.values()).flat().isEmpty())) {
          // If either the origin or the target source is the common folder, all elements should be
          // mergeable and we shouldn't see merge errors
          throw new Error(`Failed to add ${gids.map(id => id.getFullName())} - unmergeable element fragments.`)
        }
        const after = (await awu(mergeResult.merged.values()).peek()) as ChangeDataType
        return detailedCompare(before, after, { createFieldChanges: true })
      })
      .flatMap(change => separateChangeByFiles(change, change.action === 'remove' ? targetSource : originSource))
      .toArray()
    return fullChanges
  }, 'addToSource')

const createUpdateChanges = async (
  changes: DetailedChange[],
  commonSource: NaclFilesSource,
  targetSource: NaclFilesSource,
): Promise<DetailedChange[]> => {
  const [nestedAdditions, otherChanges] = await promises.array.partition(
    changes,
    async change =>
      change.action === 'add' && change.id.nestingLevel > 0 && !(await targetSource.get(change.id.createParentID())),
  )
  // const modifiedAdditions = await awu(Object.entries(_.groupBy(
  //   nestedAdditions,
  //   addition => addition.id.createTopLevelParentID().parent.getFullName()
  // )))
  const [fullyNestedAdditions, partiallyNestedAdditions] = await promises.array.partition(
    nestedAdditions,
    async change => !(await targetSource.get(change.id.createTopLevelParentID().parent)),
  )

  const modifiedFullyNestedAdditions = await Promise.all(
    _(fullyNestedAdditions)
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
      .value(),
  )

  const modifiedPartiallyNestedAdditions = await Promise.all(
    _(partiallyNestedAdditions)
      .groupBy(addition => addition.id.createTopLevelParentID().parent.getFullName())
      .entries()
      .map(async ([parentID, elementAdditions]) => {
        const valuesOverrides = Object.fromEntries(
          elementAdditions.filter(isAdditionChange).map(addition => [addition.id.getFullName(), addition.data.after]),
        )
        valuesOverrides[parentID] = await commonSource.get(ElemID.fromFullName(parentID))
        return addToSource({
          ids: elementAdditions.map(c => c.id),
          originSource: targetSource,
          targetSource,
          valuesOverrides,
        })
      })
      .value(),
  )
  return [...otherChanges, ..._.flatten(modifiedFullyNestedAdditions), ..._.flatten(modifiedPartiallyNestedAdditions)]
}

const routeDefaultRemoveOrModify = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChangesByRole> => {
  // We add to the current defining source.
  const currentChanges = await projectChange(change, primarySource)
  const commonChanges = await projectChange(change, commonSource)

  // When removing a top level element from common, we need to remove it from all environments
  // otherwise we are left with a partial element in the other environments
  const isTopLevelRemoveFromCommon = change.action === 'remove' && change.id.isTopLevel() && commonChanges.length > 0
  const secondaryChanges = isTopLevelRemoveFromCommon
    ? promises.object.mapValuesAsync(secondarySources, source => projectChange(change, source))
    : undefined
  return {
    primarySource: currentChanges,
    commonSource: commonChanges,
    secondarySources: await secondaryChanges,
  }
}

export const routeOverride = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChangesByRole> => {
  // If the add change projects to a secondary source we can't
  // add it to common since it is already marked as env specific.
  if (change.action === 'add') {
    const secondarySourceValues = await Promise.all(
      Object.values(secondarySources).map(source => source.get(change.id)),
    )
    if (secondarySourceValues.some(values.isDefined)) {
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
  return routeDefaultRemoveOrModify(change, primarySource, commonSource, secondarySources)
}

export const routeAlign = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
): Promise<RoutedChangesByRole> => {
  // All add changes to the current active env specific folder
  // unless it is an unmergeable id, and the mergeableID is in common
  if (change.action === 'add') {
    const topLevelID = change.id.createTopLevelParentID().parent
    const commonTopLevel = await commonSource.get(topLevelID)
    const primaryTopLevel = await primarySource.get(topLevelID)
    const { mergeableID } = getMergeableParentID(change.id, [commonTopLevel, primaryTopLevel].filter(values.isDefined))
    if (values.isDefined(await commonSource.get(mergeableID))) {
      return {}
    }
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
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChangesByRole> => {
  if (change.action === 'add') {
    const parentID = change.id.isTopLevel() ? change.id : change.id.createParentID()
    const commonParent = await commonSource.get(parentID)
    const envParents = await Promise.all(
      [primarySource, ...Object.values(secondarySources)].map(src => src.get(parentID)),
    )
    const hasCommonParent = commonParent !== undefined
    const hasEnvSpecificParent = _.some(envParents, srcElem => srcElem !== undefined)
    // If we only have 1 env we will add the element to common UNLESS its parent already
    // has a part defined in the env
    if (_.isEmpty(secondarySources) && !hasEnvSpecificParent) {
      return { commonSource: [change] }
    }
    // If the element parent is completely defined in common we will add new nested
    // additions to common
    if (hasCommonParent && !hasEnvSpecificParent) {
      return { commonSource: [change] }
    }
    return { primarySource: [change] }
  }
  return routeDefaultRemoveOrModify(change, primarySource, commonSource, secondarySources)
}

const getChangePathHint = async (
  change: DetailedChange,
  commonSource: NaclFilesSource,
): Promise<ReadonlyArray<string> | undefined> => {
  if (change.path) return change.path
  const refFilename = (await commonSource.getSourceRanges(change.id)).map(sourceRange => sourceRange.filename)[0]

  return refFilename ? toPathHint(refFilename) : undefined
}

export const routeIsolated = async (
  change: DetailedChange,
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
  secondarySources: Record<string, NaclFilesSource>,
): Promise<RoutedChangesByRole> => {
  // This is an add change, which means the element is not in common.
  // so we will add it to the current action environment.
  const pathHint = await getChangePathHint(change, commonSource)

  if (change.action === 'add') {
    return { primarySource: [change] }
  }
  // In remove and modify changes, we need to remove the current value from
  // common, add it to the inactive envs, and apply the actual change to the
  // active env.
  // If the element is not in common, then we can apply the change to
  // the primary source
  const currentCommonElement = await commonSource.get(change.id)
  if (currentCommonElement === undefined) {
    return { primarySource: [change] }
  }

  const commonChangeProjection = projectElementOrValueToEnv(getChangeData(change), currentCommonElement)
  // Add the changed part of common to the target source
  const addCommonProjectionToCurrentChanges =
    change.action === 'modify'
      ? await addToSource({
          ids: [change.id],
          originSource: commonSource,
          targetSource: primarySource,
          valuesOverrides: {
            [change.id.getFullName()]: commonChangeProjection,
          },
        })
      : []
  // Add the old value of common to the inactive sources
  const secondaryChanges = await promises.object.mapValuesAsync(secondarySources, targetSource =>
    addToSource({ ids: [change.id], originSource: commonSource, targetSource }),
  )
  const currentEnvChanges = await projectChange(change, primarySource)
  return {
    // No need to apply addToSource to primary env changes since it was handled by the original plan
    primarySource: [...currentEnvChanges, ...addCommonProjectionToCurrentChanges],
    commonSource: [createRemoveChange(currentCommonElement, change.id, pathHint)],
    secondarySources: secondaryChanges,
  }
}

const createMergeableChange = (
  mergeableID: ElemID,
  changes: DetailedChange[],
  baseElement: ChangeDataType,
): DetailedChange => {
  if (changes.length === 1 && changes[0].id.isEqual(mergeableID)) {
    return changes[0]
  }
  const afterElement = baseElement.clone()
  applyDetailedChanges(afterElement, changes)
  return {
    id: mergeableID,
    action: 'modify',
    path: changes[0].path,
    data: {
      before: resolvePath(baseElement, mergeableID),
      after: resolvePath(afterElement, mergeableID),
    },
  }
}

const createMergeableChangesForElement = async (
  topLevelID: ElemID,
  changes: DetailedChange[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
): Promise<DetailedChange[]> => {
  if (changes.every(change => change.id.isTopLevel())) {
    // changes of top level elements are always mergeable (they cannot be in an array)
    return changes
  }
  // for nested changes we need to check, if the change is inside an array
  // and that array exists in common, we will need to replace the change
  // with a change that modifies the whole array
  // this is because we cannot isolate just a part of an array
  const commonFragment = await commonSource.get(topLevelID)
  if (commonFragment === undefined) {
    // When the top level is not in common, none of the changes are going
    // to be in something that exists in common, so we can return all changes as-is
    return changes
  }
  const primaryFragment = await primarySource.get(topLevelID)
  const fragments = [commonFragment, primaryFragment].filter(values.isDefined)

  // Note that there cannot be an overlap between groups here because getMergeableParentID
  // stops on the first array it encounters
  const changesByMergeableID = _.groupBy(changes, change =>
    getMergeableParentID(change.id, fragments).mergeableID.getFullName(),
  )
  const mergeableChanges = Object.entries(changesByMergeableID).map(([mergeableID, changeGroup]) =>
    createMergeableChange(ElemID.fromFullName(mergeableID), changeGroup, commonFragment),
  )

  return mergeableChanges
}

const toMergeableChanges = async (
  changes: DetailedChange[],
  primarySource: NaclFilesSource,
  commonSource: NaclFilesSource,
): Promise<DetailedChange[]> => {
  // First we create mergeable changes!
  // We need to modify a change iff:
  // 1) It has a common projection
  // 2) It is inside an array
  const changesByTopLevel = _.groupBy(changes, change => change.id.createTopLevelParentID().parent.getFullName())
  return awu(Object.values(changesByTopLevel))
    .flatMap(changeGroup =>
      createMergeableChangesForElement(
        changeGroup[0].id.createTopLevelParentID().parent,
        changeGroup,
        primarySource,
        commonSource,
      ),
    )
    .toArray()
}

const unpackSources = (
  primarySourceName: string,
  envSources: Record<string, NaclFilesSource>,
): {
  primarySource: NaclFilesSource
  secondarySources: Record<string, NaclFilesSource>
} => ({
  primarySource: envSources[primarySourceName],
  secondarySources: Object.fromEntries(Object.entries(envSources).filter(([name, _src]) => name !== primarySourceName)),
})

export const routeChanges = async (
  rawChanges: DetailedChange[],
  primarySourceName: string,
  commonSource: NaclFilesSource,
  envSources: Record<string, NaclFilesSource>,
  mode?: RoutingMode,
): Promise<RoutedChanges> => {
  const { primarySource, secondarySources } = unpackSources(primarySourceName, envSources)
  const changes = mode === 'isolated' ? await toMergeableChanges(rawChanges, primarySource, commonSource) : rawChanges

  const routedChanges = await awu(changes)
    .map(c => {
      switch (mode) {
        case 'isolated':
          return routeIsolated(c, primarySource, commonSource, secondarySources)
        case 'align':
          return routeAlign(c, primarySource, commonSource)
        case 'override':
          return routeOverride(c, primarySource, commonSource, secondarySources)
        default:
          return routeDefault(c, primarySource, commonSource, secondarySources)
      }
    })
    .toArray()

  const secondaryEnvsChanges = _.mapValues(
    _.groupBy(
      routedChanges.flatMap(r => Object.entries(r.secondarySources || {})),
      e => e[0],
    ),
    changeEntries => changeEntries.flatMap(e => e[1]),
  )
  return {
    commonSource: await createUpdateChanges(
      _.flatten(routedChanges.map(r => r.commonSource || [])),
      commonSource,
      commonSource,
    ),
    envSources: {
      [primarySourceName]: await createUpdateChanges(
        _.flatten(routedChanges.map(r => r.primarySource || [])),
        commonSource,
        primarySource,
      ),
      ...(await promises.object.mapValuesAsync(secondaryEnvsChanges, (srcChanges, srcName) =>
        createUpdateChanges(srcChanges, commonSource, secondarySources[srcName]),
      )),
    },
  }
}

const removeFromSource = async (ids: ElemID[], targetSource: NaclFilesSource): Promise<DetailedChange[]> => {
  const groupedByTopLevel = _.groupBy(ids, id => id.createTopLevelParentID().parent.getFullName())
  return awu(Object.entries(groupedByTopLevel))
    .flatMap(async ([key, groupedIds]) => {
      const targetTopElement = await targetSource.get(ElemID.fromFullName(key))
      if (targetTopElement === undefined) {
        return []
      }
      return groupedIds.map(id => createRemoveChange(resolvePath(targetTopElement, id), id))
    })
    .flat()
    .toArray()
}

export const routePromote = async (
  ids: ElemID[],
  primarySourceName: string,
  commonSource: NaclFilesSource,
  envSources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => {
  const { primarySource, secondarySources } = unpackSources(primarySourceName, envSources)
  return {
    commonSource: await addToSource({
      ids,
      originSource: primarySource,
      targetSource: commonSource,
    }),
    envSources: {
      [primarySourceName]: await removeFromSource(ids, primarySource),
      ...(await promises.object.mapValuesAsync(secondarySources, (source: NaclFilesSource) =>
        removeFromSource(ids, source),
      )),
    },
  }
}

export const routeDemote = async (
  ids: ElemID[],
  commonSource: NaclFilesSource,
  envSources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => ({
  commonSource: await removeFromSource(ids, commonSource),
  envSources: await promises.object.mapValuesAsync(envSources, (source: NaclFilesSource) =>
    addToSource({
      ids,
      originSource: commonSource,
      targetSource: source,
    }),
  ),
})

export const routeCopyTo = async (
  ids: ElemID[],
  originSource: NaclFilesSource,
  targetSources: Record<string, NaclFilesSource>,
): Promise<RoutedChanges> => ({
  commonSource: [],
  envSources: await promises.object.mapValuesAsync(targetSources, (source: NaclFilesSource) =>
    addToSource({
      ids,
      originSource,
      targetSource: source,
      overrideTargetElements: true,
    }),
  ),
})

export const routeRemoveFrom = async (
  ids: ElemID[],
  targetSource: NaclFilesSource,
  targetSourceName: string,
): Promise<RoutedChanges> => ({
  commonSource: [],
  envSources: {
    [targetSourceName]: await removeFromSource(ids, targetSource),
  },
})
