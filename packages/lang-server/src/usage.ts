/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  } catch {
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

const getReferencingFiles = async (workspace: EditorWorkspace, id: ElemID): Promise<string[]> =>
  awu(await workspace.getElementIncomingReferences(id.createBaseID().parent))
    .concat(
      id.idType === 'type'
        ? awu(await (await workspace.elements).list()).filter(
            elemId => elemId.adapter === id.adapter && elemId.typeName === id.typeName && elemId.idType === 'instance',
          )
        : [],
    )
    .uniquify(referencingId => referencingId.getFullName())
    .flatMap(referencingId => workspace.getElementNaclFiles(referencingId))
    .uniquify(filename => filename)
    .toArray()

const getUsageInFile = async (
  workspace: EditorWorkspace,
  filename: string,
  id: ElemID,
): Promise<{ filename: string; fullname: string }[]> =>
  awu(await workspace.getElements(filename))
    .flatMap(async e => getElemIDUsages(e, id))
    .map(fullname => ({ filename, fullname }))
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
  const referencedByFiles = await getReferencingFiles(workspace, id)
  const usages = await Promise.all(referencedByFiles.map(filename => getUsageInFile(workspace, filename, id)))
  const elementNaclFiles = await workspace.getElementNaclFiles(id)
  const selfReferences = elementNaclFiles.map(filename => ({
    filename,
    fullname: id.getFullName(),
  }))

  return usages.flat().concat(selfReferences)
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
