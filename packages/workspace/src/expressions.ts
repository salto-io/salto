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
  ReferenceExpression, TemplateExpression, isVariable,
  isReferenceExpression, isVariableExpression,
} from '@salto-io/adapter-api'
import {
  resolvePath,
} from '@salto-io/adapter-utils'

type Resolver<T> = (
  v: T,
  contextElements: Record<string, Element[]>,
  visited?: Set<string>
) => Value

export class UnresolvedReference {
  constructor(public target: ElemID) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  contextElements: Record<string, Element[]>,
  visited: Set<string> = new Set<string>(),
): Value => {
  if (isReferenceExpression(value)) {
    const resValue = resolveReferenceExpression(value, contextElements, visited)
    return value.createWithValue(resValue)
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, contextElements, visited)
  }

  return undefined
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
  // Validation should throw an error if there is no match, or more than one match
  const rootElement = contextElements[parent.getFullName()]
    && contextElements[parent.getFullName()][0]

  if (!rootElement) {
    return new UnresolvedReference(fullElemID)
  }

  const value = resolvePath(rootElement, fullElemID)

  if (value === undefined) {
    return new UnresolvedReference(fullElemID)
  }

  /**
  When resolving a VariableExpression which references a Variable element, we should get a
  VariableExpression with the value of that variable as its value.
  So Variable elements should not appear in the value of VariableExpressions.
  */
  if (isVariableExpression(expression)) {
    // Replace the Variable element by its value.
    return resolveMaybeExpression(value.value, contextElements, visited) ?? value.value
  }

  return resolveMaybeExpression(value, contextElements, visited) ?? value
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

const resolveElement = (
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

  if (isVariable(element)) {
    element.value = _.cloneWith(element.value, referenceCloner)
  }

  element.annotations = _.cloneDeepWith(element.annotations, referenceCloner)

  return element
}

export const resolve = (elements: readonly Element[],
  additionalContext: ReadonlyArray<Element> = []): Element[] => {
  const additionalContextElements = _.groupBy(additionalContext, e => e.elemID.getFullName())
  const contextElements = {
    ...additionalContextElements,
    ..._.groupBy(elements, e => e.elemID.getFullName()),
  }
  return elements.map(e => resolveElement(e, contextElements))
}
