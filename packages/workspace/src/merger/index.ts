/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { isObjectType, isInstanceElement, Element, isPrimitiveType, isVariable } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { mergeObjectTypes } from './internal/object_types'
import { mergeInstances } from './internal/instances'
import { mergeVariables } from './internal/variables'
import { mergePrimitives } from './internal/primitives'
import { MergeError, MergeResult as InternalMergeResult } from './internal/common'
import { InMemoryRemoteMap, ReadOnlyRemoteMap } from '../workspace/remote_map'

const { awu } = collections.asynciterable

export { MergeError, DuplicateAnnotationError } from './internal/common'
export {
  DuplicateAnnotationFieldDefinitionError,
  ConflictingFieldTypesError,
  ConflictingSettingError,
  DuplicateAnnotationTypeError,
} from './internal/object_types'
export { DuplicateInstanceKeyError } from './internal/instances'
export { MultiplePrimitiveTypesError } from './internal/primitives'
export { DuplicateVariableNameError } from './internal/variables'
export type MergeResult = {
  merged: ReadOnlyRemoteMap<Element>
  errors: ReadOnlyRemoteMap<MergeError[]>
}

const log = logger(module)

const mergeElement = (newElement: Element, existingElement?: Element): InternalMergeResult<Element> => {
  if (isPrimitiveType(newElement) && isPrimitiveType(existingElement)) {
    return mergePrimitives([newElement, existingElement])
  }
  if (isObjectType(newElement) && isObjectType(existingElement)) {
    return mergeObjectTypes([newElement, existingElement])
  }
  if (isInstanceElement(newElement) && isInstanceElement(existingElement)) {
    return mergeInstances([newElement, existingElement])
  }
  if (isVariable(newElement) && isVariable(existingElement)) {
    return mergeVariables([newElement, existingElement])
  }
  return {
    merged: newElement,
    errors: [],
  }
}

export const mergeElements = async (elements: AsyncIterable<Element>): Promise<MergeResult> => {
  let elementsCounter = 0
  let mergedCounter = 0
  let errorsCounter = 0
  const merged = new InMemoryRemoteMap<Element>()
  const errors = new InMemoryRemoteMap<MergeError[]>()
  await awu(elements).forEach(async element => {
    const existingElement = await merged.get(element.elemID.getFullName())
    if (existingElement === undefined) {
      mergedCounter += 1
    }
    const mergeResult = mergeElement(element, existingElement)
    elementsCounter += 1
    errorsCounter += mergeResult.errors.length
    await merged.set(element.elemID.getFullName(), mergeResult.merged)
    if (!_.isEmpty(mergeResult.errors)) {
      await errors.set(element.elemID.getFullName(), mergeResult.errors)
    }
  })

  log.debug(`merged ${elementsCounter} elements to ${mergedCounter} elements [errors=${errorsCounter}]`)
  if (errorsCounter > 0) {
    log.warn(
      `All merge errors:\n${(
        await awu(errors.values())
          .flatMap(elemErrs => elemErrs.map(e => e.message))
          .toArray()
      ).join('\n')}`,
    )
  }

  return { merged, errors }
}

export const mergeSingleElement = async <T extends Element>(elementParts: T[]): Promise<T> => {
  const mergeRes = await mergeElements(awu(elementParts))

  const errorMessages = await awu(mergeRes.errors.entries())
    .flatMap(err => err.value)
    .map(err => err.message)
    .toArray()
  if (errorMessages.length !== 0) {
    throw new Error(`Received merge errors: ${errorMessages.join(', ')}`)
  }
  const [error] = await awu(mergeRes.errors.entries()).toArray()
  if (error !== undefined) {
    throw new Error(`Received merge errors: ${error.key}: ${error.value.map(err => err.message).join(', ')}`)
  }

  const mergedElements = await awu(mergeRes.merged.values()).toArray()

  if (mergedElements.length !== 1) {
    throw new Error(
      `Received invalid number of merged elements when expected one: ${mergedElements.map(e => e.elemID.getFullName()).join(', ')}`,
    )
  }

  // A merge of elements of type T should result an element of type T
  return mergedElements[0] as T
}
