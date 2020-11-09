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
  ElemID, isElement, isInstanceElement, Element, InstanceElement, ReferenceExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { Workspace } from '@salto-io/workspace'
import { resolvePath, setPath, transformElement, TransformFunc } from '@salto-io/adapter-utils'

/**
 * Generate a list of elements referenced by one or more of the specified elements in the
 * current environment.
 *
 * @param workspace     The workspace to run the query on
 * @param ids           The list of elem ids to start from
 * @param maxDepth      The max number of hops to take from the original elements in the traversal
 */
export const listElementDependencies = async (
  workspace: Workspace,
  ids: ElemID[],
  maxDepth: number,
): Promise<string[]> => {
  const initialElemIDs = new Set(ids.map(id => id.getFullName()))
  const referencedElemIDs = new Set<string>()
  const rootElements = Object.fromEntries(
    (await workspace.elements(true, workspace.currentEnv()))
      .filter(e => e.elemID.isTopLevel())
      .map(e => [e.elemID.getFullName(), e])
  )

  const getElem = (id: ElemID): Element | undefined => {
    const rootElem = rootElements[id.createTopLevelParentID().parent.getFullName()]
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
        rootElem.type,
        {},
        rootElem.path,
      )
      setPath(newInstance, id, val)
      return newInstance
    }
    return undefined
  }

  const hasReferencedAncestor = (idStr: string): boolean => {
    const alreadyReferenced = (elemID: ElemID): boolean => {
      if (referencedElemIDs.has(elemID.getFullName())) {
        return true
      }
      if (elemID.isTopLevel()) {
        return false
      }
      return alreadyReferenced(elemID.createParentID())
    }

    const elemID = ElemID.fromFullName(idStr)
    if (elemID.isTopLevel()) {
      return false
    }
    return alreadyReferenced(elemID.createParentID())
  }

  const uniq = (deps: ReferenceExpression[]): ReferenceExpression[] => (
    _.uniqBy(deps, dep => dep.elemId.getFullName())
  )

  let elemRefs = uniq((ids.map(
    id => new ReferenceExpression(id, getElem(id))
  ).filter(ref => ref.value !== undefined)))

  for (let level = 0; level <= maxDepth; level += 1) {
    if (elemRefs.length === 0) {
      break
    }
    const nextLevel: ReferenceExpression[] = []
    elemRefs.forEach(ref => {
      if (referencedElemIDs.has(ref.elemId.getFullName())
        || hasReferencedAncestor(ref.elemId.getFullName())) {
        return
      }
      referencedElemIDs.add(ref.elemId.getFullName())

      const deps: ReferenceExpression[] = []
      const findReferences: TransformFunc = ({ value }) => {
        if (isReferenceExpression(value)) {
          deps.push(new ReferenceExpression(value.elemId, value.value ?? getElem(value.elemId)))
          return undefined
        }
        return value
      }

      transformElement({
        element: ref.value,
        transformFunc: findReferences,
      })
      nextLevel.push(...deps)
    })
    elemRefs = uniq(nextLevel).filter(dep => !referencedElemIDs.has(dep.elemId.getFullName()))
  }

  return [...referencedElemIDs]
    .filter(idStr => !hasReferencedAncestor(idStr))
    .filter(elemID => !initialElemIDs.has(elemID))
    .sort()
}
