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
import _ from 'lodash'
import {
  ElemID, Element,
} from '@salto-io/adapter-api'
import { Workspace, validator } from '@salto-io/workspace'

const { validateElements, isUnresolvedRefError } = validator

export type UnresolvedElemIDs = {
  found: ElemID[]
  missing: ElemID[]
}

/**
 * Filter out descendants from the list of sorted elem ids.
 *
 * @param sortedIds   The list of elem id full names, sorted alphabetically
 */
const compact = (sortedIds: string[]): string[] => {
  const ret = sortedIds.slice(0, 1)
  sortedIds.slice(1).forEach(id => {
    if (!id.startsWith(`${ret.slice(-1)[0]}.`)) {
      ret.push(id)
    }
  })
  return ret
}

/**
 * Compute the unresolved references in the current environment.
 * If completeFromEnv is specified, use it to resolve the missing references recursively.
 *
 * @param workspace     The workspace to run the query on
 * @completeFromEnv     The env to use to populate the references from and look for additional
 *                      downstream missing references
 */
export const listUnresolvedReferences = async (
  workspace: Workspace,
  completeFromEnv?: string,
): Promise<UnresolvedElemIDs> => {
  const getUnresolvedElemIDs = (
    elements: ReadonlyArray<Element>,
    additionalContext?: ReadonlyArray<Element>,
  ): ElemID[] => _.uniqBy(
    validateElements(elements, additionalContext).filter(isUnresolvedRefError).map(e => e.target),
    elemID => elemID.getFullName(),
  )

  const workspaceElements = await workspace.elements(true, workspace.currentEnv())
  const unresolvedElemIDs = getUnresolvedElemIDs(workspaceElements)

  if (completeFromEnv === undefined) {
    return {
      found: [],
      missing: _.sortBy(unresolvedElemIDs, id => id.getFullName()),
    }
  }

  const idsToMove = new Set<string>()
  const missing = new Set<string>()

  const addAndValidate = async (ids: ElemID[]): Promise<void> => {
    if (ids.length === 0) {
      return
    }

    const copy = async (idsToCopy: ElemID[]): Promise<ElemID[]> => {
      const env = workspace.currentEnv()

      const copyWithRetry = async (elemIDs: ElemID[]): Promise<ElemID[]> => {
        try {
          await workspace.copyTo(elemIDs, [env])
          return []
        } catch (e) {
          if (elemIDs.length <= 1) {
            return elemIDs
          }
          return (await Promise.all(elemIDs.map(id => copyWithRetry([id])))).flat()
        }
      }

      await workspace.setCurrentEnv(completeFromEnv, false)
      const failed = await copyWithRetry(idsToCopy)
      await workspace.setCurrentEnv(env, false)
      return failed
    }

    ids.forEach(id => idsToMove.add(id.getFullName()))
    const failed = await copy(ids)
    failed.forEach(id => missing.add(id.getFullName()))
    const idLookup = new Set(ids.map(id => id.getFullName()))
    const [moved, existing] = _.partition(
      await workspace.elements(true, workspace.currentEnv()),
      e => (
        idLookup.has(e.elemID.getFullName())
        || idLookup.has(e.elemID.createTopLevelParentID().parent.getFullName())
      ),
    )
    const unresolvedIDs = getUnresolvedElemIDs(moved, existing)
    await addAndValidate(unresolvedIDs.filter(id => !idsToMove.has(id.getFullName())))
  }

  await addAndValidate(unresolvedElemIDs)

  return {
    found: compact([...idsToMove].filter(id => !missing.has(id)).sort()).map(ElemID.fromFullName),
    missing: [...missing].sort().map(ElemID.fromFullName),
  }
}
