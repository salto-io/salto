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
import { Element, isInstanceElement, isReferenceExpression, isIndexPathPart, ElemID,
  isObjectType, getDeepInnerType, Value, isContainerType } from '@salto-io/adapter-api'
import { transformElement, TransformFuncArgs } from '@salto-io/adapter-utils'
import { getLocations, SaltoElemLocation, SaltoElemFileLocation } from './location'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'
import { Token } from './token'


const getElemIDUsages = async (
  element: Element,
  id: ElemID
): Promise<string[]> => {
  const pathsToAdd = new Set<string>()
  if (isObjectType(element)) {
    _(element.fields)
      .values()
      .filter(f => {
        const fieldType = f.type
        const nonGenericType = isContainerType(fieldType) ? getDeepInnerType(fieldType) : f.type
        return id.isEqual(nonGenericType.elemID)
      }).forEach(f => pathsToAdd.add(f.elemID.getFullName()))
  }
  if (isInstanceElement(element) && element.type.elemID.isEqual(id)) {
    pathsToAdd.add(element.elemID.getFullName())
  }
  const transformFunc = ({ value, field, path }: TransformFuncArgs): Value => {
    if (field?.elemID.isEqual(id) && path && !isIndexPathPart(path.name)) {
      pathsToAdd.add(path.getFullName())
    }
    if (isReferenceExpression(value) && path) {
      if (id.isEqual(value.elemId) || id.isParentOf(value.elemId)) {
        pathsToAdd.add(path.getFullName())
      }
    }
    return value
  }
  if (!isContainerType(element)) {
    transformElement({ element, transformFunc, strict: false })
  }
  return [...pathsToAdd]
}

const isTokenElemID = (token: string): boolean => {
  try {
    const refID = ElemID.fromFullName(token)
    return !refID.isConfig() || !refID.isTopLevel()
  } catch (e) {
    return false
  }
}

export const getSearchElementFullName = (
  context: PositionContext,
  token: string
): ElemID | undefined => {
  if (isTokenElemID(token)) {
    return ElemID.fromFullName(token)
  }
  if (context.ref !== undefined) {
    if (!_.isEmpty(context.ref.path) && context.type === 'type') {
      return context.ref?.element.elemID.createNestedID('attr', ...context.ref.path)
    }
    if (!_.isEmpty(context.ref.path) && context.type === 'field') {
      return context.ref?.element.elemID.createNestedID(...context.ref.path)
    }
    return context.ref?.element.elemID
  }
  return undefined
}

export const getReferencingFiles = async (
  workspace: EditorWorkspace,
  fullName: string
): Promise<string[]> => {
  try {
    const id = ElemID.fromFullName(fullName)
    return workspace.getElementReferencedFiles(id)
  } catch (e) {
    return []
  }
}

export const getUsageInFile = async (
  workspace: EditorWorkspace,
  filename: string,
  id: ElemID
): Promise<string[]> => _((await Promise.all(
  (await workspace.getElements(filename)).map(e => getElemIDUsages(e, id))
))).flatten().uniq().value()

export const getWorkspaceReferences = async (
  workspace: EditorWorkspace,
  tokenValue: string,
  context: PositionContext
): Promise<SaltoElemFileLocation[]> => {
  const id = getSearchElementFullName(context, tokenValue)
  if (id === undefined) {
    return []
  }
  const referencedByFiles = await getReferencingFiles(workspace, id.getFullName())
  const usages = _.flatten(await Promise.all(
    referencedByFiles.map(async filename =>
      (await getUsageInFile(workspace, filename, id))
        .flatMap(elemID => ({ filename, fullname: elemID })))
  ))
  const selfReferences = (await workspace.getElementNaclFiles(id))
    .map(filename => ({ filename, fullname: id.getFullName() }))
  return [...usages, ...selfReferences]
}

export const provideWorkspaceReferences = async (
  workspace: EditorWorkspace,
  token: Token,
  context: PositionContext
): Promise<SaltoElemLocation[]> => {
  const usages = _.uniq(
    (await getWorkspaceReferences(workspace, token.value, context))
      .map(usage => usage.fullname)
  )
  // We need a single await for all get location calls in order to take advantage
  // of the Salto SaaS getFiles aggregation functionality
  return (await Promise.all(usages.map(usage => getLocations(workspace, usage)))).flat()
}
