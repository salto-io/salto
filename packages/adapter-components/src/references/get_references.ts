/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { WALK_NEXT_STEP, walkOnElement, WalkOnFunc } from '@salto-io/adapter-utils'
import {
  isElement,
  isReferenceExpression,
  isTemplateExpression,
  Element,
  isStaticFile,
  TemplateExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import { parserUtils } from '@salto-io/parser'

export const getAllReferencedIds = async (element: Element, onlyAnnotations = false): Promise<Set<string>> => {
  const allReferencedIds = new Set<string>()
  const templateStaticFiles: StaticFile[] = []
  const getReferencesFromTemplateExpression = (template?: TemplateExpression): void => {
    template?.parts.forEach(part => {
      if (isReferenceExpression(part)) {
        allReferencedIds.add(part.elemID.getFullName())
      }
    })
  }
  const func: WalkOnFunc = ({ value, path }) => {
    // if onlyAnnotations is true - skip the non annotations part
    if (onlyAnnotations && !path.isAttrID()) {
      // If this is an element we need to recurse in order to get to the annotations
      return isElement(value) ? WALK_NEXT_STEP.RECURSE : WALK_NEXT_STEP.SKIP
    }
    if (isReferenceExpression(value)) {
      allReferencedIds.add(value.elemID.getFullName())
      return WALK_NEXT_STEP.SKIP
    }
    if (isTemplateExpression(value)) {
      getReferencesFromTemplateExpression(value)
      return WALK_NEXT_STEP.SKIP
    }
    if (isStaticFile(value) && value.isTemplate) {
      templateStaticFiles.push(value)
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func })
  const templateExpressions = await Promise.all(
    templateStaticFiles.map(async file => parserUtils.staticFileToTemplateExpression(file)),
  )
  templateExpressions.forEach(getReferencesFromTemplateExpression)
  return allReferencedIds
}
