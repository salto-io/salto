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
import { logger } from '@salto-io/logging'
import {
  ElemID, Element, isObjectType, isInstanceElement, Value,
  ReferenceExpression, TemplateExpression, isVariable,
  isReferenceExpression, isVariableExpression, Field, BuiltinTypes, TypeElement, isListType,
} from '@salto-io/adapter-api'
import {
  resolvePath,
} from '@salto-io/adapter-utils'

const log = logger(module)

type Resolver<T> = (
  v: T,
  contextElements: Record<string, Element>,
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
  contextElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Value => {
  if (isReferenceExpression(value)) {
    return resolveReferenceExpression(value, contextElements, visited)
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, contextElements, visited)
  }

  return undefined
}

resolveReferenceExpression = (
  expression: ReferenceExpression,
  contextElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): ReferenceExpression => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)

  if (visited.has(traversal)) {
    return expression.createWithValue(new CircularReference(traversal))
  }
  visited.add(traversal)

  const fullElemID = ElemID.fromFullName(traversal)
  const { parent } = fullElemID.createTopLevelParentID()
  // Validation should throw an error if there is no match, or more than one match
  const rootElement = contextElements[parent.getFullName()]

  if (!rootElement) {
    return expression.createWithValue(new UnresolvedReference(fullElemID))
  }

  const value = resolvePath(rootElement, fullElemID)

  if (value === undefined) {
    return expression.createWithValue(new UnresolvedReference(fullElemID))
  }

  /**
  When resolving a VariableExpression which references a Variable element, we should get a
  VariableExpression with the value of that variable as its value.
  So Variable elements should not appear in the value of VariableExpressions.
  */
  if (isVariableExpression(expression)) {
    // Replace the Variable element by its value.
    return expression.createWithValue(
      resolveMaybeExpression(value.value, contextElements, visited) ?? value.value,
      rootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    resolveMaybeExpression(value, contextElements, visited) ?? value,
    rootElement,
  )
}

resolveTemplateExpression = (
  expression: TemplateExpression,
  contextElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Value => expression.parts
  .map(p => {
    const res = resolveMaybeExpression(p, contextElements, visited)
    return res ? res?.value ?? res : p
  })
  .join('')

const resolveElement = (
  element: Element,
  contextElements: Record<string, Element>
): void => {
  const referenceCloner = (v: Value): Value => resolveMaybeExpression(v, contextElements)

  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
  }

  if (isObjectType(element)) {
    const ensureCopyExistsOnce = (field: Field, source: Element): Element => {
      const name = source.elemID.getFullName()
      let result = contextElements[name]
      if (!result) {
        if (!isListType(source)) {
          // TODO: find out why this is happening e.g, for
          // TODO: "element salesforce.Text at field AccountNumber in salesforce.Account"
          log.warn(
            'Cannot find element %s at field %s in %s',
            field.type.elemID.getFullName(),
            field.name, field.parent.elemID.getFullName(),
          )
        }
        result = _.clone(source)
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        resolveElement(result, contextElements)
        contextElements[name] = result
      }
      return result
    }

    // keep references (e.g, parent, type)
    element.fields = _.mapValues(
      element.fields,
      field => {
        const result = new Field(
          element,
          field.name,
          ensureCopyExistsOnce(field, field.type) as TypeElement,
          _.cloneDeepWith(field.annotations, referenceCloner),
        )
        result.annotationTypes = _.cloneDeepWith(field.annotationTypes, referenceCloner)
        return result
      }
    )
  }

  if (isVariable(element)) {
    element.value = _.cloneWith(element.value, referenceCloner)
  }

  element.annotations = _.cloneDeepWith(element.annotations, referenceCloner)
  element.annotationTypes = _.cloneDeepWith(element.annotationTypes, referenceCloner)
}

export const resolve = (elements: readonly Element[],
  additionalContext: ReadonlyArray<Element> = []): Element[] => {
  // intentionally shallow clone because in resolve element we replace only top level properties
  const clonedElements = elements.map(_.clone)
  const contextElements = Object.fromEntries([
    ...Object.values(BuiltinTypes),
    ...additionalContext,
    ...clonedElements,
  ].map(e => [e.elemID.getFullName(), e]))
  clonedElements.forEach(e => resolveElement(e, contextElements))
  return clonedElements
}
