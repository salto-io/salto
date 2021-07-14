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
import { ElemID, Element, Value, ReferenceExpression, TemplateExpression, isReferenceExpression, isVariableExpression, isElement, ReadOnlyElementsSource, isVariable, isInstanceElement, isObjectType, isContainerType, isField, Field } from '@salto-io/adapter-api'
import { resolvePath, TransformFunc, createRefToElmWithValue, transformValues } from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'

const { mapValuesAsync } = promises.object

type WorkingSetElement = {
  element: Element
  resolved?: boolean
}

const { awu } = collections.asynciterable
type Resolver<T> = (
  v: T,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited?: Set<string>,
  resolveRoot?: boolean
) => Promise<Value>

export class UnresolvedReference {
  constructor(public target: ElemID) {
  }
}

export class CircularReference {
  constructor(public ref: string) {}
}

const getResolvedElement = async (
  elemID: ElemID,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
): Promise<Element | undefined> => {
  if (workingSetElements[elemID.getFullName()] !== undefined) {
    return workingSetElements[elemID.getFullName()].element
  }
  const element = await elementsSource.get(elemID)
  if (element !== undefined) {
    return _.clone(element)
  }
  return element
}

let resolveTemplateExpression: Resolver<TemplateExpression>

const resolveMaybeExpression: Resolver<Value> = async (
  value: Value,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited: Set<string> = new Set<string>(),
  resolveRoot = false
): Promise<Value> => {
  if (isReferenceExpression(value)) {
    // eslint-disable-next-line no-use-before-define
    return resolveReferenceExpression(
      value,
      elementsSource,
      workingSetElements,
      visited,
      resolveRoot
    )
  }

  if (value instanceof TemplateExpression) {
    return resolveTemplateExpression(
      value,
      elementsSource,
      workingSetElements,
      visited,
      resolveRoot
    )
  }

  if (isElement(value)) {
    // eslint-disable-next-line no-use-before-define
    return (await resolveElement(
      value,
      elementsSource,
      workingSetElements
    )) ?? value
  }
  return value
}

export const resolveReferenceExpression = async (
  expression: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited: Set<string> = new Set<string>(),
  resolveRoot = false
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

  // eslint-disable-next-line no-use-before-define
  const resolvedRootElement = resolveRoot ? await resolveElement(
    rootElement,
    elementsSource,
    workingSetElements
  ) : undefined

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
        resolveRoot
      ) ?? value.value,
      resolvedRootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    await resolveMaybeExpression(value, elementsSource, workingSetElements, visited, resolveRoot)
      ?? value,
    resolvedRootElement,
  )
}

resolveTemplateExpression = async (
  expression: TemplateExpression,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  visited: Set<string> = new Set<string>(),
  resolveRoot = false
): Promise<Value> => (await awu(expression.parts)
  .map(async p => {
    const res = await resolveMaybeExpression(
      p, elementsSource, workingSetElements, visited, resolveRoot
    )
    return res ? res?.value ?? res : p
  }).toArray())
  .join('')

const resolveElement = async (
  elementToResolve: Element,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  resolveRoot = false
): Promise<Element> => {
  const referenceCloner: TransformFunc = ({ value }) => resolveMaybeExpression(
    value,
    elementsSource,
    workingSetElements,
    undefined,
    resolveRoot
  )
  if (workingSetElements[elementToResolve.elemID.getFullName()]?.resolved) {
    return workingSetElements[elementToResolve.elemID.getFullName()].element
  }
  if (workingSetElements[elementToResolve.elemID.getFullName()] === undefined) {
    workingSetElements[elementToResolve.elemID.getFullName()] = {
      element: _.clone(elementToResolve),
    }
  }

  const { element } = workingSetElements[elementToResolve.elemID.getFullName()]
  if (workingSetElements[element.elemID.getFullName()] === undefined) {
    workingSetElements[element.elemID.getFullName()] = { element }
  }
  // Mark this as resolved before resolving to prevent cycles
  workingSetElements[element.elemID.getFullName()].resolved = true


  const elementAnnoTypes = await element.getAnnotationTypes(elementsSource)
  element.annotationRefTypes = await mapValuesAsync(
    elementAnnoTypes,
    async type => createRefToElmWithValue(
      await resolveElement(type, elementsSource, workingSetElements, resolveRoot)
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
        await element.getInnerType(elementsSource),
        elementsSource,
        workingSetElements,
        resolveRoot
      )
    )
  }

  if (isInstanceElement(element) || isField(element)) {
    element.refType = createRefToElmWithValue(
      await resolveElement(
        await element.getType(elementsSource),
        elementsSource,
        workingSetElements,
        resolveRoot
      )
    )
  }

  if (isInstanceElement(element)) {
    element.value = (await transformValues({
      transformFunc: referenceCloner,
      values: element.value,
      elementsSource,
      strict: false,
      type: await element.getType(elementsSource),
      allowEmpty: true,
    })) ?? {}
  }

  if (isObjectType(element)) {
    element.fields = await mapValuesAsync(
      element.fields,
      field => resolveElement(
        field,
        elementsSource,
        workingSetElements,
        resolveRoot
      )
    ) as Record<string, Field>
  }

  if (isVariable(element)) {
    element.value = await resolveMaybeExpression(
      element.value,
      elementsSource,
      workingSetElements,
      new Set(),
      resolveRoot
    )
  }

  return element
}

export const resolve = async (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
  resolveRoot = false
): Promise<Element[]> => {
  const elementsToResolve = elements.map(_.clone)
  const resolvedElements = await awu(elementsToResolve)
    .map(element => ({ element }))
    .keyBy(
      workingSetElement => workingSetElement.element.elemID.getFullName()
    )

  const contextedElementsGetter: ReadOnlyElementsSource = {
    ...elementsSource,
    get: id =>
      (getResolvedElement(id, elementsSource, resolvedElements)),
  }
  await awu(elementsToResolve).forEach(e => resolveElement(
    e,
    contextedElementsGetter,
    resolvedElements,
    resolveRoot
  ))
  return elementsToResolve
}
