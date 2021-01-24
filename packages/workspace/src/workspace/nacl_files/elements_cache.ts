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
import _ from 'lodash'
import { Element, Change, isEqualElements, toChange, isType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { mergeElements, MergeError, updateMergedTypes } from '../../merger'

const log = logger(module)

export const calcChanges = (
  fullNames: string[],
  currentElements: Record<string, Element>,
  newElements: Record<string, Element>,
): Change[] => fullNames.map(fullName => {
  const before = currentElements[fullName]
  const after = newElements[fullName]
  if (before === undefined && after === undefined) {
    return undefined
  }
  const change = toChange({ before, after })
  return isEqualElements(before, after) ? undefined : change
}).filter(values.isDefined) as Change[]

export const calcNewMerged = <T extends MergeError | Element>(
  currentMerged: T[], newMerged: T[], relevantElementIDs: Set<string>
): T[] => currentMerged
    .filter(e =>
      !relevantElementIDs.has(e.elemID.createTopLevelParentID().parent.getFullName()))
    .concat(newMerged)

export const buildNewMergedElementsAndErrors = ({
  newElements, currentElements = {}, currentMergeErrors = [], relevantElementIDs,
}: {
  newElements: Element[]
  currentElements?: Record<string, Element>
  currentMergeErrors?: MergeError[]
  relevantElementIDs: string[]
}): {
  mergedElements: Record<string, Element>
  mergeErrors: MergeError[]
  changes: Change[]
} => {
  log.info('going to merge %d new elements to the existing %d elements',
    newElements.length, Object.keys(currentElements))
  const currentMergedElementsWithoutRelevants = _.omit(currentElements, relevantElementIDs)
  const newMergedElementsResult = mergeElements(newElements, currentMergedElementsWithoutRelevants)
  const mergeErrors = calcNewMerged(
    currentMergeErrors, newMergedElementsResult.errors, new Set(relevantElementIDs)
  )
  const mergedElements = {
    ...currentMergedElementsWithoutRelevants,
    ..._.keyBy(newMergedElementsResult.merged, e => e.elemID.getFullName()),
  } as Record<string, Element>

  const mergedElementsUpdated = _.keyBy(
    updateMergedTypes(
      Object.values(mergedElements),
      _.pickBy(mergedElements, isType),
    ),
    elem => elem.elemID.getFullName(),
  )
  const changes = calcChanges(relevantElementIDs, currentElements, mergedElementsUpdated)
  log.info('%d changes resulted from the merge', changes.length)
  return { mergeErrors, mergedElements: mergedElementsUpdated, changes }
}
