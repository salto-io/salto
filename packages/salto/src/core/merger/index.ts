import _ from 'lodash'
import {
  ObjectType, isType, isObjectType, isInstanceElement, Element,
  Type, isPrimitiveType, BuiltinTypes,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { mergeObjectTypes } from './internal/object_types'
import { mergeInstances } from './internal/instances'
import { mergePrimitives } from './internal/primitives'
import { MergeResult as InternalMergeResult } from './internal/common'

export { MergeError } from './internal/common'
export type MergeResult = InternalMergeResult<Element[]>

export {
  FieldDefinitionMergeError, NoBaseDefinitionMergeError, MultipleBaseDefinitionsMergeError,
  DuplicateAnnotationFieldDefinitionError, DuplicateAnnotationError, DuplicateAnnotationTypeError,
} from './internal/object_types'

export { DuplicateInstanceKeyError } from './internal/instances'
export { MultiplePrimitiveTypesUnsupportedError } from './internal/primitives'

const log = logger(module)

/**
 * Replace the pointers to all the merged elements to the merged version.
 */
const updateMergedTypes = (
  elements: Element[],
  mergedTypes: Record<string, Type>
): Element[] => elements.map(elem => {
  if (isType(elem)) {
    elem.annotationTypes = _.mapValues(
      elem.annotationTypes,
      anno => mergedTypes[anno.elemID.getFullName()] || anno,
    )
  }
  if (isObjectType(elem)) {
    elem.fields = _.mapValues(
      elem.fields,
      field => {
        field.type = mergedTypes[field.type.elemID.getFullName()] || field.type
        return field
      }
    )
  }
  if (isInstanceElement(elem)) {
    elem.type = mergedTypes[elem.type.elemID.getFullName()] as ObjectType || elem.type
  }
  return elem
})

/**
 * Merge a list of elements by applying all updates, and replacing the pointers
 * to the updated elements.
 */
export const mergeElements = (elements: ReadonlyArray<Element>): MergeResult => {
  const objects = mergeObjectTypes(elements.filter(isObjectType))
  const instances = mergeInstances(elements.filter(isInstanceElement))
  const primitiveElements = [...elements.filter(isPrimitiveType), ...Object.values(BuiltinTypes)]
  const primitives = mergePrimitives(primitiveElements)

  const mergedElements = [
    ...elements.filter(e => !isObjectType(e) && !isInstanceElement(e)),
    ...Object.values(objects.merged),
    ...instances.merged,
  ]

  const updated = updateMergedTypes(
    mergedElements,
    _.merge({}, objects.merged, primitives.merged)
  )

  const errors = [
    ...objects.errors,
    ...instances.errors,
    ...primitives.errors,
  ]

  log.debug(`merged ${elements.length} elements to ${updated.length} elements [errors=${
    errors.length}]`)
  return {
    merged: updated,
    errors,
  }
}
