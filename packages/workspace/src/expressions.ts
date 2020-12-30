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
import { ElemID, Element, isObjectType, isInstanceElement, Value, ReferenceExpression, TemplateExpression, isVariable, isReferenceExpression, isVariableExpression, isElement, Field, ElementsSource, isType } from '@salto-io/adapter-api'
import { resolvePath, createRefToElmWithValue } from '@salto-io/adapter-utils'
// import { collections } from '@salto-io/lowerdash'

// const { asynciterable } = collections

type Resolver<T> = (
  v: T,
  elementsSource: ElementsSource,
  resolvedElements: Record<string, Element>,
  visited?: Set<string>,
) => Value

export class UnresolvedReference {
  constructor(public target: ElemID) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

const getResolvedElement = (
  elemID: ElemID, elementsSource: ElementsSource, resolvedElements: Record<string, Element>
): Element | undefined =>
  (resolvedElements[elemID.getFullName()] ?? elementsSource.getSync(elemID))

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = (
  value: Value,
  elementsSource: ElementsSource,
  resolvedElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Value => {
  if (isReferenceExpression(value)) {
    return resolveReferenceExpression(value, elementsSource, resolvedElements, visited)
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, elementsSource, resolvedElements, visited)
  }

  // We do not want to recurse into elements because we can assume they will also be resolved
  // at some point (because we are calling resolve on all elements), so if we encounter an element
  // all we need to do is make it point to the element from the context
  if (isElement(value)) {
    return getResolvedElement(value.elemID, elementsSource, resolvedElements)
  }

  return undefined
}

resolveReferenceExpression = (
  expression: ReferenceExpression,
  elementsSource: ElementsSource,
  resolvedElements: Record<string, Element>,
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
  // Validation should throw an error if there is no match
  const rootElement = resolvedElements[parent.getFullName()] ?? elementsSource.getSync(parent)

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
      resolveMaybeExpression(value.value, elementsSource, resolvedElements, visited) ?? value.value,
      rootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    resolveMaybeExpression(value, elementsSource, resolvedElements, visited) ?? value,
    rootElement,
  )
}

resolveTemplateExpression = (
  expression: TemplateExpression,
  elementsSource: ElementsSource,
  resolvedElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Value => expression.parts
  .map(p => {
    const res = resolveMaybeExpression(p, elementsSource, resolvedElements, visited)
    return res ? res?.value ?? res : p
  })
  .join('')

const resolveElement = (
  element: Element,
  elementsSource: ElementsSource,
  resolvedElements: Record<string, Element>,
): void => {
  const proxyElementSource = {
    getSync: (id: ElemID): Value =>
      (getResolvedElement(id, elementsSource, resolvedElements)),
  }
  const referenceCloner = (v: Value): Value => resolveMaybeExpression(
    v,
    elementsSource,
    resolvedElements
  )
  if (isInstanceElement(element)) {
    element.value = _.cloneDeepWith(element.value, referenceCloner)
    element.refType = createRefToElmWithValue(element.getType(proxyElementSource))
  }

  if (isObjectType(element)) {
    element.fields = _.mapValues(
      element.fields,
      field => (new Field(
        element,
        field.name,
        field.getType(proxyElementSource),
        _.cloneDeepWith(field.annotations, referenceCloner),
      )),
    )
  }

  if (isVariable(element)) {
    element.value = _.cloneWith(element.value, referenceCloner)
  }
  element.annotations = _.cloneDeepWith(element.annotations, referenceCloner)
  // This is a workaround because annotationTypes are not Fields
  // and do not have getType
  // const dummyAnnoTypeObj = new ObjectType({
  //   elemID: new ElemID(GLOBAL_ADAPTER, 'dummyAnnoType'), // dummy elemID, it's not really used
  //   fields: _.mapValues(
  //     element.annotationRefTypes,
  //     refType => ({ refType }),
  //   ),
  // })
  // element.annotationRefTypes = _.mapValues(
  //   dummyAnnoTypeObj.fields,
  //   dummyField => (createRefToElmWithValue(dummyField.getType(proxyElementSource)))
  // )
  element.annotationRefTypes = _.mapValues(
    element.annotationRefTypes,
    refType => {
      const resolvedType = getResolvedElement(refType.elemID, elementsSource, resolvedElements)
      if (!isType(resolvedType)) {
        throw new Error(`annotationType ${refType.elemID.getFullName()}'s type (${refType.elemID.getFullName()}) did not resolve to TypeElement`)
      }
      return createRefToElmWithValue(resolvedType)
    }
  )
}

// const printElementsSourceId = (elm: ElementsSource): void => {
//   elm.list().then(a => {
//     asynciterable.toArrayAsync(a).then(ar => {
//       console.log(ar.map(z => z.getFullName()).join(','))
//       throw new Error(ar.map(z => z.getFullName()).join(','))
//     })
//   })
// }

export const resolve = (
  elements: ReadonlyArray<Element>,
  elementsSource: ElementsSource,
): Element[] => {
  // printElementsSourceId(elementsSource)
  // intentionally shallow clone because in resolve element we replace only top level properties
  const clonedElements = elements.map(_.clone)
  const resolvedElements = _.keyBy(
    clonedElements,
    elm => elm.elemID.getFullName()
  )
  clonedElements.forEach(e => resolveElement(e, elementsSource, resolvedElements))
  return clonedElements
}
