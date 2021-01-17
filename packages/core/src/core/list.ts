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
import { ElemID, Element, isElement, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { Workspace, validator } from '@salto-io/workspace'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import { resolvePath, setPath } from '@salto-io/adapter-utils'


const { awu } = collections.asynciterable
const { validateElements, isUnresolvedRefError } = validator
const { isDefined } = lowerDashValues

export type UnresolvedElemIDs = {
  found: ElemID[]
  missing: ElemID[]
}

/**
 * Filter out descendants from a list of sorted elem ids.
 *
 * @param sortedIds   The list of elem id full names, sorted alphabetically
 */
const compact = (sortedIds: ElemID[]): ElemID[] => {
  const ret = sortedIds.slice(0, 1)
  sortedIds.slice(1).forEach(id => {
    const lastItem = _.last(ret) as ElemID // if we're in the loop then ret is not empty
    if (!lastItem.isParentOf(id)) {
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
  const getUnresolvedElemIDsFromErrors = async (): Promise<ElemID[]> => {
    const errors = (await workspace.errors())
      .validation.filter(isUnresolvedRefError)
      .map(e => e.target)
    return _.uniqBy(errors, elemID => elemID.getFullName())
  }

  const getUnresolvedElemIDs = async (
    elements: ReadonlyArray<Element>,
  ): Promise<ElemID[]> => _.uniqBy(
    (await validateElements(elements, await workspace.elements()))
      .filter(isUnresolvedRefError).map(e => e.target),
    elemID => elemID.getFullName(),
  )

  const unresolvedElemIDs = await getUnresolvedElemIDsFromErrors()

  if (completeFromEnv === undefined) {
    return {
      found: [],
      missing: compact(_.sortBy(unresolvedElemIDs, id => id.getFullName())),
    }
  }

  const addAndValidate = async (
    ids: ElemID[], elements: Element[] = [],
  ): Promise<{ completed: string[]; missing: string[] }> => {
    if (ids.length === 0) {
      return { completed: [], missing: [] }
    }

    const getCompletionElem = async (id: ElemID): Promise<Element | undefined> => {
      const rootElem = await (await workspace.elements(true, completeFromEnv))
        .get(id.createTopLevelParentID().parent)
      if (!rootElem) {
        return undefined
      }
      const val = resolvePath(rootElem, id)
      if (isElement(val)) {
        return val
      }
      if (isInstanceElement(rootElem) && !id.isTopLevel()) {
        const newInstance = new InstanceElement(
          rootElem.elemID.name,
          rootElem.refType,
          {},
          rootElem.path,
        )
        setPath(newInstance, id, val)
        return newInstance
      }
      return undefined
    }

    const completionRes = Object.fromEntries(
      await awu(ids).map(async id => ([
        id.getFullName(),
        await getCompletionElem(id),
      ])).toArray()
    ) as Record<string, Element | undefined>

    const [completed, missing] = _.partition(
      Object.keys(completionRes), id => isDefined(completionRes[id])
    )
    const resolvedElements = Object.values(completionRes).filter(isDefined)
    const unresolvedIDs = await getUnresolvedElemIDs(resolvedElements)

    const innerRes = await addAndValidate(
      unresolvedIDs,
      [...elements, ...resolvedElements]
    )
    return {
      completed: [...completed, ...innerRes.completed],
      missing: [...missing, ...innerRes.missing],
    }
  }

  const { completed, missing } = await addAndValidate(unresolvedElemIDs)

  return {
    found: compact(completed.sort().map(ElemID.fromFullName)),
    missing: compact(missing.sort().map(ElemID.fromFullName)),
  }
}
