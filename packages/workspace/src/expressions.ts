/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, Element, Value, ReferenceExpression, TemplateExpression, isReferenceExpression, isVariableExpression, isElement, ReadOnlyElementsSource, isVariable, isInstanceElement, isObjectType, isContainerType, isField, Field, isTypeReference, createRefToElmWithValue } from '@salto-io/adapter-api'
import { resolvePath, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'

const log = logger(module)
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
  resolveRoot: boolean,
  visited?: Set<string>
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
  resolveRoot: boolean,
  visited: Set<string> = new Set<string>(),
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
      resolveRoot,
      visited
    )
  }

  if (isElement(value)) {
    // eslint-disable-next-line no-use-before-define
    return (await resolveElement(
      value,
      elementsSource,
      workingSetElements,
      resolveRoot
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
    workingSetElements,
    resolveRoot
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
        resolveRoot,
        visited
      ) ?? value.value,
      resolvedRootElement,
    )
  }
  return (expression as ReferenceExpression).createWithValue(
    await resolveMaybeExpression(value, elementsSource, workingSetElements, resolveRoot, visited)
      ?? value,
    resolvedRootElement,
  )
}

resolveTemplateExpression = async (
  expression: TemplateExpression,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  resolveRoot: boolean,
  visited: Set<string> = new Set<string>(),
): Promise<Value> => (await awu(expression.parts)
  .map(async p => {
    const res = await resolveMaybeExpression(
      p, elementsSource, workingSetElements, resolveRoot, visited
    )
    return res ? res?.value ?? res : p
  }).toArray())
  .join('')

const resolveElement = async <T extends Element>(
  elementToResolve: T,
  elementsSource: ReadOnlyElementsSource,
  workingSetElements: Record<string, WorkingSetElement>,
  resolveRoot: boolean
): Promise<T> => {
  const clonedRefs: Record<string, ReferenceExpression> = {}
  const referenceCloner: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      clonedRefs[value.elemID.getFullName()] = clonedRefs[value.elemID.getFullName()]
        || _.clone(value)
      return clonedRefs[value.elemID.getFullName()]
    }
    return resolveMaybeExpression(
      value,
      elementsSource,
      workingSetElements,
      resolveRoot && !isTypeReference(value),
      undefined,
    )
  }

  if (workingSetElements[elementToResolve.elemID.getFullName()]?.resolved) {
    return workingSetElements[elementToResolve.elemID.getFullName()].element as T
  }
  if (workingSetElements[elementToResolve.elemID.getFullName()] === undefined) {
    workingSetElements[elementToResolve.elemID.getFullName()] = {
      element: _.clone(elementToResolve),
    }
  }

  const { element } = workingSetElements[elementToResolve.elemID.getFullName()]
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
      resolveRoot,
      new Set()
    )
  }

  await awu(Object.values(clonedRefs)).forEach(async ref => {
    const resolvedRef = await resolveMaybeExpression(
      ref,
      elementsSource,
      workingSetElements,
      resolveRoot,
      new Set()
    )
    ref.value = resolvedRef.value
    ref.topLevelParent = resolvedRef.topLevelParent
  })
  return element as T
}

export const resolve = (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
  resolveRoot = false
): Promise<Element[]> => log.time(async () => {
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
}, 'resolve %d elements', elements.length)
