/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, Element, Value, ReferenceExpression, TemplateExpression, isReferenceExpression, isVariableExpression, isElement, ReadOnlyElementsSource, isVariable, isInstanceElement, isObjectType, isContainerType, isField } from '@salto-io/adapter-api'
import { resolvePath, TransformFunc, createRefToElmWithValue, transformValues } from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'

const { mapValuesAsync } = promises.object

type WorkingSetElement = {
  element: Element
  resolved: boolean
}

const { awu } = collections.asynciterable
type Resolver<T> = (
  v: T,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited?: Set<string>,
  resolvedSet?: Set<string>
) => Promise<Value>

export class UnresolvedReference {
  constructor(public target: ElemID) {}
}

export class CircularReference {
  constructor(public ref: string) {}
}

const getResolvedElement = async (
  elemID: ElemID,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
): Promise<Element | undefined> => {
  if (workingSetElements[elemID.getFullName()]?.resolved) {
    return workingSetElements[elemID.getFullName()].element
  }
  const unresolvedElement = workingSetElements[elemID.getFullName()]?.element
     ?? await elementsSource.get(elemID)

  if (unresolvedElement !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return resolveElement(
      unresolvedElement,
      elementsSource,
      workingSetElements,
    )
  }

  return undefined
}

let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = async (
  value: Value,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited: Set<string> = new Set<string>(),
): Promise<Value> => {
  if (isReferenceExpression(value)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return resolveReferenceExpression(
      value,
      elementsSource,
      workingSetElements,
      visited,
    )
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(value, elementsSource, workingSetElements, visited)
  }
  // We do not want to recurse into elements because we can assume they will also be resolved
  // at some point (because we are calling resolve on all elements), so if we encounter an element
  // all we need to do is make it point to the element from the context. If the element is not in
  // the context or the source - we'll keep it as it is.
  if (isElement(value)) {
    return (await getResolvedElement(value.elemID, elementsSource, workingSetElements))
      ?? value
  }
  return value
}

export const resolveReferenceExpression = async (
  expression: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
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
  const rootElement = workingSetElements[parent.getFullName()]?.element
    ?? await elementsSource.get(parent)

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
        workingSetElements,
        visited,
      ) ?? value.value,
      rootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    await resolveMaybeExpression(value, elementsSource, workingSetElements, visited)
      ?? value,
    rootElement,
  )
}

resolveTemplateExpression = async (
  expression: TemplateExpression,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited: Set<string> = new Set<string>(),
): Promise<Value> => (await awu(expression.parts)
  .map(async p => {
    const res = await resolveMaybeExpression(
      p, elementsSource, workingSetElements, visited
    )
    return res ? res?.value ?? res : p
  }).toArray())
  .join('')

const resolveElement = async (
  element: Element,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
): Promise<Element> => {
  // Create a ReadonlyElementSource (ElementsGetter) with the proper context
  // to be used to resolve types. If it was already resolved use the reolsved and if not
  // fallback to the elementsSource
  const contextedElementsGetter: ReadOnlyElementsSource = {
    ...elementsSource,
    get: id =>
      (getResolvedElement(id, elementsSource, workingSetElements)),
  }
  const referenceCloner: TransformFunc = ({ value }) => resolveMaybeExpression(
    value,
    elementsSource,
    workingSetElements,
    undefined,
  )

  if (workingSetElements[element.elemID.getFullName()] !== undefined) {
    return element
  }
  // Mark this as resolved before resolving to prevent cycles
  workingSetElements[element.elemID.getFullName()] = { element, resolved: true }

  const elementAnnoTypes = await element.getAnnotationTypes(contextedElementsGetter)
  element.annotationRefTypes = await mapValuesAsync(
    elementAnnoTypes,
    async type => createRefToElmWithValue(
      await resolveElement(type, elementsSource, workingSetElements)
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

  if (isContainerType(element)) {
    element.refInnerType = createRefToElmWithValue(
      await resolveElement(
        await element.getInnerType(contextedElementsGetter),
        elementsSource,
        workingSetElements,
      )
    )
  }


  if (isInstanceElement(element) || isField(element)) {
    element.refType = createRefToElmWithValue(
      await resolveElement(
        await element.getType(contextedElementsGetter),
        elementsSource,
        workingSetElements,
      )
    )
  }

  if (isInstanceElement(element)) {
    element.value = (await transformValues({
      transformFunc: referenceCloner,
      values: element.value,
      elementsSource,
      strict: false,
      type: await element.getType(contextedElementsGetter),
      allowEmpty: true,
    })) ?? {}
  }

  if (isObjectType(element)) {
    await awu(Object.values(element.fields)).forEach(field => resolveElement(
      field,
      elementsSource,
      workingSetElements,
    ))
  }

  if (isVariable(element)) {
    element.value = await resolveMaybeExpression(element.value, elementsSource, workingSetElements)
  }

  return element
}

export const resolve = async (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
  inPlace = false
): Promise<Element[]> => {
  // intentionally shallow clone because in resolve element we replace only top level properties
  const elementsToResolve = inPlace
    ? elements
    : await awu(elements).map(_.clone).toArray()
  const resolvedElements = await awu(elementsToResolve)
    .map(element => ({ element, resolved: false }))
    .keyBy(
      workingSetElement => workingSetElement.element.elemID.getFullName()
    )
  await awu(elementsToResolve).forEach(e => resolveElement(
    e,
    elementsSource,
    resolvedElements
  ))
  return elementsToResolve
}
