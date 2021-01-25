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
import {
  isObjectType, isInstanceElement, Element, isPrimitiveType, isVariable,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { mergeObjectTypes } from './internal/object_types'
import { mergeInstances } from './internal/instances'
import { mergeVariables } from './internal/variables'
import { mergePrimitives } from './internal/primitives'
import { MergeError, MergeResult as InternalMergeResult } from './internal/common'
import { RemoteMap, InMemoryRemoteMap } from '../workspace/remote_map'

const { awu } = collections.asynciterable

export { MergeError, DuplicateAnnotationError } from './internal/common'
export {
  DuplicateAnnotationFieldDefinitionError, ConflictingFieldTypesError,
  ConflictingSettingError, DuplicateAnnotationTypeError,
} from './internal/object_types'
export { DuplicateInstanceKeyError } from './internal/instances'
export { MultiplePrimitiveTypesUnsupportedError } from './internal/primitives'
export { DuplicateVariableNameError } from './internal/variables'
export type MergeResult = {
  merged: RemoteMap<Element>
  errors: RemoteMap<MergeError[]>
}

const log = logger(module)

const mergeElement = (
  newElement: Element,
  existingElement?: Element
): InternalMergeResult<Element> => {
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

export const mergeElements = async (
  elements: AsyncIterable<Element>
): Promise<MergeResult> => {
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
    await errors.set(element.elemID.getFullName(), mergeResult.errors)
  })

  log.debug(`merged ${elementsCounter} elements to ${mergedCounter} elements [errors=${
    errorsCounter}]`)
  if (errorsCounter > 0) {
    log.debug(`All merge errors:\n${(await awu(errors.values())
      .flatMap(elemErrs => elemErrs.map(e => e.message)).toArray())
      .join('\n')}`)
  }

  return { merged, errors }
}
