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
  ElemID, Element, isObjectType, isInstanceElement, Value,
  ReferenceExpression, TemplateExpression, resolvePath,
  StaticAssetExpression,
} from '@salto-io/adapter-api'

type Resolver<T> = (
  v: T,
  contextElements: Record<string, Element[]>,
  visited?: Set<string>
) => Value

export class UnresolvedReference {
  constructor(public ref: string) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>
let resolveStaticAssetExpression: Resolver<StaticAssetExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => {
  if (value instanceof StaticAssetExpression) {
    return resolveStaticAssetExpression(value, contextElements, visited)
  }

  if (value instanceof ReferenceExpression) {
    return new ReferenceExpression(
      value.elemId,
      resolveReferenceExpression(value, contextElements, visited)
    )
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, contextElements, visited)
  }

  return undefined
}

resolveStaticAssetExpression = (
  expression: StaticAssetExpression,
  // TODO: Remove these ts and lint ignores upon real implementation
  // @ts-ignore
  contextElements: Record<string, Element[]>, // tslint:disable
  visited: Set<string> = new Set<string>(),
): Value => {
  const { value: filepath } = expression
  if (visited.has(filepath)) {
    return new CircularReference(filepath)
  }
  visited.add(filepath)

  return expression.text
}

resolveReferenceExpression = (
  expression: ReferenceExpression,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)

  if (visited.has(traversal)) {
    return new CircularReference(traversal)
  }
  visited.add(traversal)

  const fullElemID = ElemID.fromFullName(traversal)
  const { parent } = fullElemID.createTopLevelParentID()
  // Validation should throw an error if there is not match, or more than one match
  const rootElement = contextElements[parent.getFullName()]
    && contextElements[parent.getFullName()][0]

  if (!rootElement) {
    return new UnresolvedReference(traversal)
  }

  const value = resolvePath(rootElement, fullElemID)

  if (value === undefined) {
    return new UnresolvedReference(traversal)
  }

  return resolveMaybeExpression(value, contextElements, visited) || value
}

resolveTemplateExpression = (
  expression: TemplateExpression,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => expression.parts
  .map(p => {
    const res = resolveMaybeExpression(p, contextElements, visited)
    return res ? res?.value ?? res : p
  })
  .join('')

export const resolveElement = (
  srcElement: Element,
  contextElements: Record<string, Element[]>
): Element => {
  const referenceCloner = (v: Value): Value => resolveMaybeExpression(v, contextElements)
  const element = _.clone(srcElement)
  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
  }

  if (isObjectType(element)) {
    element.fields = _.cloneDeepWith(element.fields, referenceCloner)
  }

  element.annotations = _.cloneDeepWith(element.annotations, referenceCloner)

  return element
}

export const resolve = (elements: readonly Element[]): Element[] => {
  const contextElements = _.groupBy(elements, e => e.elemID.getFullName())
  return elements.map(e => resolveElement(e, contextElements))
}
