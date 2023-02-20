/*
*                      Copyright 2023 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ElemID, Element, ReferenceExpression, TemplateExpression, isReferenceExpression, isElement, ReadOnlyElementsSource, isVariable, isInstanceElement, isObjectType, isContainerType, BuiltinTypes, CoreAnnotationTypes, TypeReference, isType, PlaceholderObjectType, Expression, isTemplateExpression, isExpression, isField, UnresolvedReference } from '@salto-io/adapter-api'
import { resolvePath, safeJsonStringify, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { DataNodeMap } from '@salto-io/dag'
import { buildContainerType } from './workspace/elements_source'

const log = logger(module)
const { awu } = collections.asynciterable

export class CircularReference {
  constructor(public ref: string) {}
}

const markCircularReferences = (referenceGraph: DataNodeMap<Expression>): void => {
  const cycle = referenceGraph.getCycle()
  if (cycle === undefined) {
    return
  }
  // Get all references that depend on anything in the cycle we found
  const referenceIdsInCycle = referenceGraph.getComponent({ roots: cycle.flat(), reverse: true })
  // Mark these as circular references
  wu(referenceIdsInCycle)
    .map(refId => referenceGraph.getData(refId))
    .forEach(ref => {
      if (isReferenceExpression(ref)) {
        ref.value = new CircularReference(ref.elemID.getFullName())
      } else {
        ref.parts
          .filter(isReferenceExpression)
          .forEach(innerRef => {
            innerRef.value = new CircularReference(innerRef.elemID.getFullName())
          })
      }
    })
  // Remove the references we marked and run again in case there is another cycle
  markCircularReferences(referenceGraph.cloneWithout(referenceIdsInCycle))
}

const setTypeOnReference = (reference: TypeReference, type: unknown): void => {
  if (isType(type)) {
    reference.type = type
  } else {
    // As a last resort, resolve to a placeholder type to mark this as a missing type
    reference.type = new PlaceholderObjectType({ elemID: reference.elemID })
  }
}

const getResolvedType = (
  typeId: ElemID,
  resolvedElements: Map<string, Element>
): Element | undefined => {
  const resolvedType = resolvedElements.get(typeId.getFullName())
  if (resolvedType !== undefined) {
    return resolvedType
  }
  // In case we are looking for a container type that doesn't exist yet
  // we can create it immediately if the inner type exists
  const containerInfo = typeId.getContainerPrefixAndInnerType()
  if (containerInfo !== undefined) {
    const inner = getResolvedType(
      ElemID.fromFullName(containerInfo.innerTypeName),
      resolvedElements,
    )
    if (isType(inner)) {
      const containerType = buildContainerType(containerInfo.prefix, inner)
      resolvedElements.set(typeId.getFullName(), containerType)
      return containerType
    }
  }
  return undefined
}

const getElementCloneFromSource = async (
  id: ElemID,
  elementsSource: ReadOnlyElementsSource,
): Promise<Element | undefined> => {
  const elem = await elementsSource.get(id)
  if (!isElement(elem)) {
    if (elem !== undefined) {
      // we can expect to get "undefined" sometimes, but we should never get something
      // that is not undefined and not an element
      log.warn('resolve expected element at ID %s but found %s', id.getFullName(), elem)
    }
    return undefined
  }
  // We create a clone because we must not modify the element from the read only source
  const elemToResolve = elem.clone()
  return elemToResolve
}

type ResolveContext = {
  resolvedElements: Map<string, Element>
  elementsSource: ReadOnlyElementsSource
  referenceDependencies: DataNodeMap<Expression>
  pendingAsyncResolves: Map<string, Promise<Element | undefined>>
  pendingAsyncOperations: Promise<unknown>[]
}
type ResolveFunctions = {
  resolveTypeReference: (reference: TypeReference) => void

  resolveReferenceExpression: (
    reference: ReferenceExpression,
    referenceSourceID: ElemID,
    template?: TemplateExpression,
  ) => void

  resolveTemplateExpression: (
    template: TemplateExpression,
    referenceSourceID: ElemID
  ) => void
}

const getResolveFunctions = ({
  resolvedElements,
  elementsSource,
  referenceDependencies,
  pendingAsyncResolves,
  pendingAsyncOperations,
}: ResolveContext): ResolveFunctions => {
  const getElementClone = (id: ElemID): Promise<Element | undefined> => {
    const pendingResolve = pendingAsyncResolves.get(id.getFullName())
    if (pendingResolve !== undefined) {
      return pendingResolve
    }
    const newPendingResolve = getElementCloneFromSource(id, elementsSource)
    pendingAsyncResolves.set(id.getFullName(), newPendingResolve)
    return newPendingResolve
  }

  const setValueOnReference = (
    reference: ReferenceExpression,
    parent: Element | undefined,
    referenceSourceID: ElemID,
    template?: TemplateExpression,
  ): void => {
    if (parent === undefined) {
      reference.value = new UnresolvedReference(reference.elemID)
      return
    }
    const value = resolvePath(parent, reference.elemID)
    if (value === undefined) {
      reference.value = new UnresolvedReference(reference.elemID)
      return
    }
    // Because variables get resolved directly to their value, in order to identify circular
    // references we need to "dereference" variables here.
    // this is only for circular reference checking
    const targetValue = isVariable(value) ? value.value : value
    if (isExpression(targetValue)) {
      // This has the potential to be a circular reference, we add a dependency saying our reference
      // depends on our target ID, once we finish resolving all references we'll be able to know if
      // there were any cycles
      // Note - currently we only mark direct cycles as circular references, if the cycle is not
      //   direct (i.e - we reference an object and that object contains a reference back), we do
      //   not consider that a circular reference
      const outgoingReferences = isReferenceExpression(targetValue)
        ? [reference]
        : targetValue.parts.filter(isReferenceExpression)

      referenceDependencies.addNode(
        referenceSourceID.getFullName(),
        outgoingReferences.map(outgoingRef => outgoingRef.elemID.getFullName()),
        template ?? reference,
      )
    }
    reference.value = value
    reference.topLevelParent = parent
  }

  const resolveTypeReference = (typeReference: TypeReference): void => {
    const syncResolvedType = getResolvedType(typeReference.elemID, resolvedElements)
    if (syncResolvedType !== undefined) {
      setTypeOnReference(typeReference, syncResolvedType)
    } else {
      // For container types we only need to get the inner type, we will handle creating
      // the container type in "getResolvedType" after the promise is resolved
      const typeId = ElemID.getTypeOrContainerTypeID(typeReference.elemID)
      const pendingResolve = getElementClone(typeId)
      pendingAsyncOperations.push(
        pendingResolve.then(resolveResult => {
          if (resolveResult === undefined) {
            setTypeOnReference(typeReference, resolveResult)
          } else {
            const resolvedType = getResolvedType(
              typeReference.elemID,
              new Map([[resolveResult.elemID.getFullName(), resolveResult]])
            )
            setTypeOnReference(typeReference, resolvedType)
          }
        })
      )
    }
  }

  const resolveReferenceExpression = (
    reference: ReferenceExpression,
    referenceSourceID: ElemID,
    template?: TemplateExpression,
  ): void => {
    const { parent } = reference.elemID.createTopLevelParentID()
    const resolvedParent = resolvedElements.get(parent.getFullName())
    if (resolvedParent !== undefined) {
      setValueOnReference(reference, resolvedParent, referenceSourceID, template)
    } else {
      const pendingResolve = getElementClone(parent)
      pendingAsyncOperations.push(
        pendingResolve.then(resParent => {
          setValueOnReference(reference, resParent, referenceSourceID, template)
        })
      )
    }
  }

  const resolveTemplateExpression = (
    template: TemplateExpression,
    referenceSourceID: ElemID
  ): void => {
    template.parts
      .filter(isReferenceExpression)
      .forEach(innerRef => {
        resolveReferenceExpression(innerRef, referenceSourceID, template)
      })
  }

  return {
    resolveTypeReference,
    resolveReferenceExpression,
    resolveTemplateExpression,
  }
}

const getClonedElements = (elements: Element[]): Element[] => {
  const [fields, restOfElements] = _.partition(elements, isField)
  const clonedRestOfElements = restOfElements.map(e => e.clone())
  const clonedTypesMap = new Map(
    clonedRestOfElements.filter(isObjectType)
      .map(type => [type.elemID.getFullName(), type]),
  )
  const clonedMissingParentsMap = new Map(
    fields.map(field => field.parent)
      .filter(parent => !clonedTypesMap.has(parent.elemID.getFullName()))
      .map(parent => [parent.elemID.getFullName(), parent.clone()])
  )
  // We want to get the fields from the cloned parents so we keep them pointing the parents
  // that will be resolved and we don't use an uncloned parent type.
  const clonedFields = fields.map(field => {
    const fieldFromClonedParent = clonedTypesMap.get(field.parent.elemID.getFullName())?.fields[field.name]
      ?? clonedMissingParentsMap.get(field.parent.elemID.getFullName())?.fields[field.name]
    if (fieldFromClonedParent === undefined) {
      log.warn(
        'field %s does not exists on its parent type %s (fields: %o)',
        field.name,
        field.parent.elemID.getFullName(),
        Object.keys(field.parent.fields)
      )
      return field.clone()
    }
    return fieldFromClonedParent
  })

  return clonedRestOfElements.concat(clonedFields)
}

export const resolve = (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource
): Promise<Element[]> => log.time(async () => {
  // Create a clone of the input elements to ensure we do not modify the input
  const elementsToResolve = getClonedElements(elements)

  // Since fields technically reference their parent type with the .parent property
  // we need to make sure to resolve all field parents as well
  const fieldParents = elementsToResolve.filter(isField).map(field => field.parent)

  // We assume that if we got a field and its parent type in the same resolve call, the field's
  // parent will point to the same object type that we got to resolve, so we don't need to resolve
  // both.
  const allElementsToResolve = _.uniqBy(
    elementsToResolve.concat(fieldParents),
    elem => elem.elemID.getFullName()
  )

  const resolvedElements = new Map(
    allElementsToResolve
      .concat(Object.values(BuiltinTypes))
      .concat(Object.values(CoreAnnotationTypes))
      .map(elem => [elem.elemID.getFullName(), elem])
  )

  // This graph will hold references that depend on other references
  // this will be used to find reference cycles once we finished resolving all references
  const referenceDependencies = new DataNodeMap<Expression>()

  const resolveElementGroup = async (elementGroup: Element[]): Promise<void> => {
    // This map will hold a promise for each async resolve that is required in this element group
    const pendingAsyncResolves = new Map<string, Promise<Element | undefined>>()
    const pendingAsyncOperations: Promise<unknown>[] = []

    const {
      resolveTypeReference,
      resolveReferenceExpression,
      resolveTemplateExpression,
    } = getResolveFunctions({
      resolvedElements,
      elementsSource,
      referenceDependencies,
      pendingAsyncResolves,
      pendingAsyncOperations,
    })

    const resolveSingleElement = (element: Element): void => {
      if (isInstanceElement(element)) {
        resolveTypeReference(element.refType)
      }
      if (isType(element)) {
        Object.values(element.annotationRefTypes)
          .forEach(resolveTypeReference)
      }
      if (isObjectType(element)) {
        Object.values(element.fields)
          .forEach(field => resolveTypeReference(field.refType))
      }
      if (isContainerType(element)) {
        resolveTypeReference(element.refInnerType)
      }
      if (isField(element)) {
        // Note - we don't need to resolve the field's parent here because it will be passed
        // as a separate element to resolve
        resolveTypeReference(element.refType)
      }

      walkOnElement({
        element,
        func: ({ value, path }) => {
          try {
            if (isReferenceExpression(value)) {
              resolveReferenceExpression(value, path)
              return WALK_NEXT_STEP.SKIP
            }
            if (isTemplateExpression(value)) {
              resolveTemplateExpression(value, path)
              return WALK_NEXT_STEP.SKIP
            }
          } catch (err) {
            log.error(`Failed to resolve path ${path.getFullName()}. value: ${safeJsonStringify(value, undefined, 2)}`)
            throw err
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
    }

    // Note - this fills pendingAsyncResolves and pendingAsyncOperations as a side effect
    elementGroup.forEach(resolveSingleElement)

    // Note, not using Promise.all here because this might be a very long list and go over the
    // allowed limits of V8
    const nextLevelToResolve = (await awu(pendingAsyncResolves.values())
      .map(promise => promise)
      .toArray())
      .filter(values.isDefined)
    // Wait for all pending operations, not just the resolves
    await awu(pendingAsyncOperations).forEach(promise => promise)

    if (nextLevelToResolve.length > 0) {
      nextLevelToResolve.forEach(elem => resolvedElements.set(elem.elemID.getFullName(), elem))
      await resolveElementGroup(nextLevelToResolve)
    }
  }

  await resolveElementGroup(allElementsToResolve)
  log.debug('resolve handled a total of %d elements', resolvedElements.size)

  // Note - resolveElementGroup fills referenceDependencies as a side effect
  // now that referenceDependencies contains all the dependencies, we can find cycles
  // and mark them as circular references
  markCircularReferences(referenceDependencies)

  return elementsToResolve
}, 'resolve %d elements', elements.length)
