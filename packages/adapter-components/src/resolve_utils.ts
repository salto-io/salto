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

export const resolveValues: ResolveValuesFunc = async (element, getLookUpName, elementsSource, allowEmpty = true) => {
  const valuesReplacer: TransformFunc = async ({ value, field, path }) => {
    if (isReferenceExpression(value)) {
      return getLookUpName({
        // Make sure the reference here is always resolved
        ref:
          value.value === undefined && elementsSource !== undefined
            ? new ReferenceExpression(value.elemID, await value.getResolvedValue(elementsSource), value.topLevelParent)
            : value,
        field,
        path,
        element,
      })
    }
    if (isStaticFile(value)) {
      if (value.isTemplate) {
        return parserUtils.staticFileToTemplateExpression(value)
      }
      const content = await value.getContent()
      return value.encoding === 'binary' ? content : content?.toString(value.encoding)
    }
    return value
  }

  return transformElement({
    element,
    transformFunc: valuesReplacer,
    strict: false,
    elementsSource,
    allowEmpty,
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
