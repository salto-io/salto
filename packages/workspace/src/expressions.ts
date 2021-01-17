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
import { ElemID, Element, Value, ReferenceExpression, TemplateExpression, isReferenceExpression, isVariableExpression, isElement, ReadOnlyElementsSource, isVariable, isInstanceElement, isObjectType, Field, TypeElement } from '@salto-io/adapter-api'
import { resolvePath, TransformFunc, createRefToElmWithValue, transformValues } from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'

const { mapValuesAsync } = promises.object

const { awu } = collections.asynciterable
type Resolver<T> = (
  v: T,
  elementsSource: ReadOnlyElementsSource,
  resolvedElements: Record<string, Element>,
  visited?: Set<string>,
) => Promise<Value>

export class UnresolvedReference {
  constructor(public target: ElemID) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

const getResolvedElement = async (
  elemID: ElemID, elementsSource: ReadOnlyElementsSource, resolvedElements: Record<string, Element>
): Promise<Element | undefined> =>
  (resolvedElements[elemID.getFullName()] ?? elementsSource.get(elemID))

let resolveReferenceExpression: Resolver<ReferenceExpression>
let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = async (
  value: Value,
  elementsSource: ReadOnlyElementsSource,
  resolvedElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Promise<Value> => {
  if (isReferenceExpression(value)) {
    return resolveReferenceExpression(value, elementsSource, resolvedElements, visited)
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, elementsSource, resolvedElements, visited)
  }
  // We do not want to recurse into elements because we can assume they will also be resolved
  // at some point (because we are calling resolve on all elements), so if we encounter an element
  // all we need to do is make it point to the element from the context. If the element is not in
  // the context or the source - we'll keep it as it is.
  if (isElement(value)) {
    return (await getResolvedElement(value.elemID, elementsSource, resolvedElements)) ?? value
  }
  return value
}

resolveReferenceExpression = async (
  expression: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
  resolvedElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Promise<ReferenceExpression> => {
  const { traversalParts } = expression
  const traversal = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)

  if (visited.has(traversal)) {
    return expression.createWithValue(new CircularReference(traversal))
  }
  visited.add(traversal)

  const fullElemID = ElemID.fromFullName(traversal)
  const { parent } = fullElemID.createTopLevelParentID()
  // Validation should throw an error if there is no match
  const rootElement = resolvedElements[parent.getFullName()] ?? await elementsSource.get(parent)

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
      await resolveMaybeExpression(
        value.value,
        elementsSource,
        resolvedElements,
        visited
      ) ?? value.value,
      rootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    await resolveMaybeExpression(value, elementsSource, resolvedElements, visited) ?? value,
    rootElement,
  )
}

resolveTemplateExpression = async (
  expression: TemplateExpression,
  elementsSource: ReadOnlyElementsSource,
  resolvedElements: Record<string, Element>,
  visited: Set<string> = new Set<string>(),
): Promise<Value> => (await awu(expression.parts)
  .map(async p => {
    const res = await resolveMaybeExpression(p, elementsSource, resolvedElements, visited)
    return res ? res?.value ?? res : p
  }).toArray())
  .join('')

const resolveElement = async (
  element: Element,
  elementsSource: ReadOnlyElementsSource,
  resolvedElements: Record<string, Element>,
  resolvedSet = new Set<string>()
): Promise<Element> => {
  // Create a ReadonlyElementSource (ElementsGetter) with the proper context
  // to be used to resolve types. If it was already resolved use the reolsved and if not
  // fallback to the elementsSource
  const contextedElementsGetter = {
    get: (id: ElemID): Promise<Value> =>
      (getResolvedElement(id, elementsSource, resolvedElements)),
  }
  const referenceCloner: TransformFunc = ({ value }) => resolveMaybeExpression(
    value,
    elementsSource,
    resolvedElements
  )

  if (resolvedSet.has(element.elemID.getFullName())) {
    return element
  }
  resolvedSet.add(element.elemID.getFullName())

  const elementAnnoTypes = await element.getAnnotationTypes(contextedElementsGetter)
  element.annotationRefTypes = await mapValuesAsync(
    elementAnnoTypes,
    async type => createRefToElmWithValue(
      await resolveElement(type, elementsSource, resolvedElements, resolvedSet)
    )
  )

  element.annotations = (await transformValues({
    values: element.annotations,
    transformFunc: referenceCloner,
    type: elementAnnoTypes,
    elementsSource,
    strict: false,
    allowEmpty: true,
  }) ?? {})

  if (isInstanceElement(element)) {
    element.refType = createRefToElmWithValue(
      await resolveElement(
        await element.getType(contextedElementsGetter),
        elementsSource,
        resolvedElements,
        resolvedSet
      )
    )
    element.value = (await transformValues({
      transformFunc: referenceCloner,
      values: element.value,
      elementsSource,
      strict: false,
      type: await element.getType(),
      allowEmpty: true,
    })) ?? {}
  }

  if (isObjectType(element)) {
    element.fields = await mapValuesAsync(
      element.fields,
      async field => {
        const fieldType = await resolveElement(
          await field.getType(contextedElementsGetter),
          elementsSource,
          resolvedElements,
          resolvedSet
        )
        return new Field(
          element,
          field.name,
          fieldType as TypeElement,
          // _.cloneDeepWith(field.annotations, referenceCloner),
          (await transformValues({
            transformFunc: referenceCloner,
            values: field.annotations,
            elementsSource,
            strict: false,
            type: await field.getAnnotationTypes(),
            allowEmpty: true,
          })) ?? {}
        )
      },
    )
  }

  if (isVariable(element)) {
    element.value = await resolveMaybeExpression(element.value, elementsSource, resolvedElements)
  }

  resolvedElements[element.elemID.getFullName()] = element
  return element
}

export const resolve = async (
  elements: AsyncIterable<Element>,
  elementsSource: ReadOnlyElementsSource,
): Promise<AsyncIterable<Element>> => {
  // intentionally shallow clone because in resolve element we replace only top level properties
  const clonedElements = await awu(elements).map(_.clone).toArray()
  const resolvedElements = _.keyBy(
    clonedElements,
    elm => elm.elemID.getFullName()
  )
  await awu(clonedElements).forEach(e => resolveElement(e, elementsSource, resolvedElements))
  return awu(clonedElements)
}
