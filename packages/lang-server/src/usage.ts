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
import _ from 'lodash'
import {
  Element,
  isInstanceElement,
  isReferenceExpression,
  ElemID,
  isObjectType,
  isContainerType,
} from '@salto-io/adapter-api'
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { getLocations, SaltoElemLocation, SaltoElemFileLocation } from './location'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'
import { Token } from './token'

const { awu } = collections.asynciterable

const getElemIDUsages = async (element: Element, id: ElemID): Promise<string[]> => {
  const pathesToAdd = new Set<string>()
  Object.entries(element.annotationRefTypes)
    .filter(([_name, annoRefType]) => id.isEqual(ElemID.getTypeOrContainerTypeID(annoRefType.elemID)))
    .forEach(([annoTypeName, _type]) =>
      pathesToAdd.add(
        new ElemID(element.elemID.adapter, element.elemID.typeName, 'annotation', annoTypeName).getFullName(),
      ),
    )
  if (isObjectType(element)) {
    Object.values(element.fields)
      .filter(field => id.isEqual(ElemID.getTypeOrContainerTypeID(field.refType.elemID)))
      .forEach(field => pathesToAdd.add(field.elemID.getFullName()))
  }
  if (isInstanceElement(element) && element.refType.elemID.isEqual(id)) {
    pathesToAdd.add(element.elemID.getFullName())
  }
  const func: WalkOnFunc = ({ value, path }) => {
    if (isReferenceExpression(value)) {
      if (id.isEqual(value.elemID) || id.isParentOf(value.elemID)) {
        pathesToAdd.add(path.getFullName())
      }
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  if (!isContainerType(element)) {
    walkOnElement({ element, func })
  }
  return [...pathesToAdd]
}

const isTokenElemID = (token: string): boolean => {
  try {
    const refID = ElemID.fromFullName(token)
    return !refID.isConfigType() || !refID.isTopLevel()
  } catch (e) {
    return false
  }
}

export const getSearchElementFullName = (context: PositionContext, token: string): ElemID | undefined => {
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

export const getReferencingFiles = async (workspace: EditorWorkspace, fullName: string): Promise<string[]> => {
  try {
    const id = ElemID.fromFullName(fullName)
    return await workspace.getElementReferencedFiles(id)
  } catch (e) {
    return []
  }
}

export const getUsageInFile = async (workspace: EditorWorkspace, filename: string, id: ElemID): Promise<ElemID[]> =>
  awu(await workspace.getElements(filename))
    .flatMap(async e => getElemIDUsages(e, id))
    .map(fullname => ElemID.fromFullName(fullname))
    .toArray()

export const getWorkspaceReferences = async (
  workspace: EditorWorkspace,
  tokenValue: string,
  context: PositionContext,
): Promise<SaltoElemFileLocation[]> => {
  const id = getSearchElementFullName(context, tokenValue)
  if (id === undefined) {
    return []
  }
  const referencedByFiles = await getReferencingFiles(workspace, id.getFullName())
  const usages = _.flatten(
    await Promise.all(
      referencedByFiles.map(async filename =>
        (await getUsageInFile(workspace, filename, id)).flatMap(elemID => ({
          filename,
          fullname: elemID.getFullName(),
        })),
      ),
    ),
  )
  const selfReferences = (await workspace.getElementNaclFiles(id)).map(filename => ({
    filename,
    fullname: id.getFullName(),
  }))
  return [...usages, ...selfReferences]
}

export const provideWorkspaceReferences = async (
  workspace: EditorWorkspace,
  token: Token,
  context: PositionContext,
): Promise<SaltoElemLocation[]> => {
  const usages = _.uniq((await getWorkspaceReferences(workspace, token.value, context)).map(usage => usage.fullname))
  // We need a single await for all get location calls in order to take advantage
  // of the Salto SaaS getFiles aggregation functionality
  return (await Promise.all(usages.map(usage => getLocations(workspace, usage)))).flat()
}
