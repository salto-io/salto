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
  ObjectType, isType, isObjectType, isInstanceElement, Element,
  isPrimitiveType, BuiltinTypes, TypeMap, ListType, isListType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { mergeObjectTypes } from './internal/object_types'
import { mergeInstances } from './internal/instances'
import { mergePrimitives } from './internal/primitives'
import { MergeResult as InternalMergeResult } from './internal/common'

export { MergeError, DuplicateAnnotationError } from './internal/common'
export type MergeResult = InternalMergeResult<Element[]>

export {
  FieldDefinitionMergeError, NoBaseDefinitionMergeError, MultipleBaseDefinitionsMergeError,
  DuplicateAnnotationFieldDefinitionError, DuplicateAnnotationTypeError,
} from './internal/object_types'

export { DuplicateInstanceKeyError, createDefaultInstanceFromType } from './internal/instances'
export { MultiplePrimitiveTypesUnsupportedError } from './internal/primitives'

const log = logger(module)

/**
 * Replace the pointers to all the merged elements to the merged version.
 */
const updateMergedTypes = (
  elements: Element[],
  mergedTypes: TypeMap
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
        const fieldType = field.type
        if (isListType(fieldType)) {
          const resolveListType = (listType: ListType): void => {
            if (isListType(listType.innerType)) {
              resolveListType(listType.innerType)
            } else {
              listType.innerType = mergedTypes[listType.innerType.elemID.getFullName()]
                || listType.innerType
            }
          }
          resolveListType(fieldType)
        }
        return field
      }
    )
  }
  if (isInstanceElement(elem)) {
    elem.type = mergedTypes[elem.type.elemID.getFullName()] as ObjectType || elem.type
  }
  return elem
})

const getListTypes = (listTypes: ListType[]): Record<string, ListType> =>
  (_(listTypes).groupBy((l => l.elemID.getFullName())).mapValues(lg => lg[0]).value())

/**
 * Merge a list of elements by applying all updates, and replacing the pointers
 * to the updated elements.
 */
export const mergeElements = (elements: ReadonlyArray<Element>): MergeResult => {
  const objects = mergeObjectTypes(elements.filter(isObjectType))
  const instances = mergeInstances(elements.filter(isInstanceElement))
  const primitiveElements = [...elements.filter(isPrimitiveType), ...Object.values(BuiltinTypes)]
  const primitives = mergePrimitives(primitiveElements)
  const listTypes = getListTypes(elements.filter(isListType))

  const mergedElements = [
    ...elements.filter(e => !isObjectType(e) && !isInstanceElement(e)),
    ...Object.values(objects.merged),
    ...instances.merged,
  ]

  const updated = updateMergedTypes(
    mergedElements,
    _.merge({}, objects.merged, primitives.merged, listTypes)
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
