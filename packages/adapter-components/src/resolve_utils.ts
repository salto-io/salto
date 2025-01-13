/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  applyFunctionToChangeData,
  GetLookupNameFunc,
  ResolveValuesFunc,
  transformElement,
  TransformFunc,
} from '@salto-io/adapter-utils'
import {
  Change,
  ChangeDataType,
  isReferenceExpression,
  isStaticFile,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { parserUtils } from '@salto-io/parser'
import { logger } from '@salto-io/logging'

const log = logger(module)

export const resolveValues: ResolveValuesFunc = async (element, getLookUpName, elementsSource, allowEmpty = true) => {
  const valuesReplacer: TransformFunc = async ({ value, field, path }) => {
    const resolveReferenceExpression = async (expression: ReferenceExpression): Promise<ReferenceExpression> =>
      expression.value === undefined && elementsSource !== undefined
        ? new ReferenceExpression(
            expression.elemID,
            await expression.getResolvedValue(elementsSource),
            expression.topLevelParent,
          )
        : expression
    if (isReferenceExpression(value)) {
      return getLookUpName({
        // Make sure the reference here is always resolved
        ref: await resolveReferenceExpression(value),
        field,
        path,
        element,
      })
    }
    if (isStaticFile(value)) {
      if (value.isTemplate) {
        const templateExpression = await parserUtils.staticFileToTemplateExpression(value)
        // resolve of references in templateExpression usually happen in core however for templateStaticFile it is not
        // possible to do it there, and therefore it happens here.
        if (templateExpression)
          templateExpression.parts = await Promise.all(
            templateExpression?.parts.map(async part =>
              isReferenceExpression(part) ? resolveReferenceExpression(part) : part,
            ),
          )
        else {
          log.warn(`Template static file is undefined with path ${value.filepath}`)
          return undefined
        }
        return templateExpression
      }
      const content = await value.getContent()
      if (content === undefined) {
        log.warn(`Static file content is undefined with path ${value.filepath}`)
        return undefined
      }
      return value.encoding === 'binary' ? content : content?.toString(value.encoding)
    }
    return value
  }

  return transformElement({
    element,
    transformFunc: valuesReplacer,
    strict: false,
    elementsSource,
    allowEmptyArrays: allowEmpty,
    allowEmptyObjects: allowEmpty,
  })
}

export const resolveChangeElement = <T extends Change<ChangeDataType> = Change<ChangeDataType>>(
  change: T,
  getLookUpName: GetLookupNameFunc,
  resolveValuesFunc = resolveValues,
  elementsSource?: ReadOnlyElementsSource,
): Promise<T> =>
  applyFunctionToChangeData(change, changeData => resolveValuesFunc(changeData, getLookUpName, elementsSource))

export type ChangeElementResolver<T extends Change<ChangeDataType> = Change<ChangeDataType>> = (change: T) => Promise<T>
export const createChangeElementResolver =
  <T extends Change<ChangeDataType> = Change<ChangeDataType>>({
    getLookUpName,
    resolveValuesFunc,
    elementSource,
  }: {
    getLookUpName: GetLookupNameFunc
    resolveValuesFunc?: ResolveValuesFunc
    elementSource?: ReadOnlyElementsSource
  }): ChangeElementResolver<T> =>
  change =>
    resolveChangeElement(change, getLookUpName, resolveValuesFunc, elementSource)
