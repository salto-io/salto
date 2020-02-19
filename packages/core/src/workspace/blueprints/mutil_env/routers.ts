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
import {
  projectChange, projectElementToEnv, createAddChange, createRemoveChange,
} from './projections'
import { DetailedChange } from '../../../core/plan'
import { createUpdateChanges } from './additionWrapper'
import { BlueprintsSource } from '../blueprints_source'

export interface RoutedChanges {
    primarySource?: DetailedChange[]
    commonSource?: DetailedChange[]
    secondarySources?: Record<string, DetailedChange[]>
}

const getMergeableParentID = (id: ElemID): {mergeableID: ElemID; path: string[]} => {
  const firstListNamePart = id.getFullNameParts().findIndex(p => !Number.isNaN(Number(p)))
  if (firstListNamePart < 0) return { mergeableID: id, path: [] }
  const mergeableNameParts = id.getFullNameParts().slice(0, firstListNamePart)
  return {
    mergeableID: ElemID.fromFullName(mergeableNameParts.join(ElemID.NAMESPACE_SEPARATOR)),
    path: id.getFullNameParts().slice(firstListNamePart),
  }
}
const createMergeableChange = async (
  changes: DetailedChange[],
  primarySource: BlueprintsSource,
  commonSource: BlueprintsSource
): Promise<DetailedChange> => {
  const refChange = changes[0]
  const { mergeableID } = getMergeableParentID(refChange.id)
  // If the mergeableID is a parent of the change id, we need to create
  // the mergeable change by manualy applying the change to the current
  // existing element.
  const base = await commonSource.get(mergeableID) || await primarySource.get(mergeableID)
  if (!_.isArrayLike(base)) throw new Error('MUST BE AN ARRAY')
  const baseAfter = _.cloneDeep(base)
  changes.forEach(change => {
    _.set(baseAfter, getMergeableParentID(change.id).path, getChangeElement(change))
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
  primarySource: BlueprintsSource,
  commonSource: BlueprintsSource,
  secondarySources: Record<string, BlueprintsSource>
): Promise<RoutedChanges> => {
  // If the add change projects to a secondary source we can't
  // add it to common since it is already marked as env specific.
  if (change.action === 'add') {
    const secondaryProjections = await Promise.all(
      _.values(secondarySources)
        .map(src => projectElementToEnv(getChangeElement(change), change.id, src))
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
  commonSource: BlueprintsSource
): Promise<string[] | undefined> => {
  if (change.path) return change.path
  const refFilename = (await commonSource.getElementBlueprints(change.id))[0]
  return refFilename
    ? [
      ...path.dirname(refFilename).split(path.sep),
      path.basename(refFilename).split('.').slice(0, -1).join('.'),
    ]
    : undefined
}

export const routeNewEnv = async (
  change: DetailedChange,
  primarySource: BlueprintsSource,
  commonSource: BlueprintsSource,
  secondarySources: Record<string, BlueprintsSource>
): Promise<RoutedChanges> => {
  // This is an add change, which means the element is not in common.
  // so we will add it to the current action enviornment.
  if (change.action === 'add') {
    return { primarySource: [change] }
  }

  // In remove and modify changes, we need to remove the current value from
  // common, add it to the inactive envs, and apply the actual change to the
  // active env.
  const changeElement = getChangeElement(change)
  const currentEnvChanges = await projectChange(change, primarySource)
  const commonChangeProjection = await projectElementToEnv(changeElement, change.id, commonSource)
  // If the element is not in common, then we can apply the change to
  // the primary source
  if (_.isUndefined(commonChangeProjection)) {
    return { primarySource: [change] }
  }
  const pathHint = await getChangePathHint(change, commonSource)
  const currentCommonElement = await commonSource.get(change.id)
  // Keeping the parser happy, this will never happen (see above)
  if (_.isUndefined(currentCommonElement)) {
    throw Error('Missing element in common')
  }
  // Add the changed part of common to the target source
  const addCommonProjectionToCurrentChanges = change.action === 'modify' && commonChangeProjection
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
          await projectChange(createAddChange(commonChangeProjection, change.id, pathHint), source),
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
  commonSource: BlueprintsSource
): Promise<[DetailedChange[], DetailedChange[]]> => {
  const mergeableChanges = []
  const nonMergeableChanges = []
  // eslint-disable-next-line no-restricted-syntax
  for (const change of changes) {
    const { mergeableID } = getMergeableParentID(change.id)
    // eslint-disable-next-line no-await-in-loop
    if (!_.isEqual(change.id, mergeableID) && await commonSource.get(mergeableID)) {
      nonMergeableChanges.push(change)
    } else {
      mergeableChanges.push(change)
    }
  }
  return [mergeableChanges, nonMergeableChanges]
}

const toMergeableChanges = async (
  changes: DetailedChange[],
  primarySource: BlueprintsSource,
  commonSource: BlueprintsSource,
): Promise<DetailedChange[]> => {
  // First we create mergeable changes!
  // We need to modify a change iff:
  // 1) It has a common projection
  // 2) It is inside an array
  const [mergeableChanges, nonMergeableChanges] = await partitionMergeableChanges(
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
  primarySource: BlueprintsSource,
  commonSource: BlueprintsSource,
  secondarySources: Record<string, BlueprintsSource>,
  mode?: string
): Promise<RoutedChanges> => {
  const changes = mode === 'strict'
    ? await toMergeableChanges(rawChanges, primarySource, commonSource)
    : rawChanges
  const routedChanges = await Promise.all(changes.map(c => (mode === 'strict'
    ? routeNewEnv(c, primarySource, commonSource, secondarySources)
    : routeFetch(c, primarySource, commonSource, secondarySources))))
  const secondaryEnvsChanges = await Promise.all(_({}).mergeWith(
    ...routedChanges.map(r => r.secondarySources || {}),
    (objValue: DetailedChange[], srcValue: DetailedChange[]) => (
      objValue ? [...objValue, ...srcValue] : srcValue
    )
  )
    .toPairs()
    .map(async ([srcName, srcChanges]) => [srcName, await createUpdateChanges(
      srcChanges,
      commonSource,
      secondarySources[srcName]
    )])
    .value())
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
    secondarySources: _.fromPairs(secondaryEnvsChanges),
  }
}
