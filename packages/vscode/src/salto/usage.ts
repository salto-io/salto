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
import { Element, isInstanceElement, isReferenceExpression, isListType, isIndexPathPart, ElemID, isObjectType, getDeepInnerType, Value } from '@salto-io/adapter-api'
import { transformElement, TransformFuncArgs } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getLocations, SaltoElemLocation } from './location'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'

// TODO - Note that this will have no great performances until we will get the
// reverse SM from @salto-io/core's core. This is acceptable as this is not called so often
const getUsages = async (
  workspace: EditorWorkspace,
  element: Element,
  fullName: string
): Promise<SaltoElemLocation[]> => {
  const pathesToAdd = new Set<ElemID>()
  if (isObjectType(element)) {
    _(element.fields)
      .values()
      .filter(f => {
        const fieldType = f.type
        const nonGenericType = isListType(fieldType) ? getDeepInnerType(fieldType) : f.type
        return fullName === nonGenericType.elemID.getFullName()
      }).forEach(f => pathesToAdd.add(f.elemID))
  }
  if (isInstanceElement(element) && element.type.elemID.getFullName() === fullName) {
    pathesToAdd.add(element.elemID)
  }
  const transformFunc = ({ value, field, path }: TransformFuncArgs): Value => {
    if (field?.elemID.getFullName() === fullName && path && !isIndexPathPart(path.name)) {
      pathesToAdd.add(path)
    }
    if (isReferenceExpression(value) && path) {
      const { parent } = value.elemId.createTopLevelParentID()
      if (parent.getFullName() === fullName || value.elemId.getFullName() === fullName) {
        pathesToAdd.add(path)
      }
    }
    return value
  }
  if (!isListType(element)) {
    transformElement({ element, transformFunc })
  }
  return _.flatten(
    await Promise.all(wu(pathesToAdd.values()).map(p => getLocations(workspace, p.getFullName())))
  )
}

export const provideWorkspaceReferences = async (
  workspace: EditorWorkspace,
  token: string,
  context: PositionContext
): Promise<SaltoElemLocation[]> => {
  const fullName = context.ref?.element.elemID.getFullName() ?? token
  return [
    ..._.flatten(await Promise.all(
      (await workspace.elements).map(e => getUsages(workspace, e, fullName))
    )),
    ...await getLocations(workspace, fullName),
  ]
}
