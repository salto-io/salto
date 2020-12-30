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
import { isObjectType, isInstanceElement, Element, isPrimitiveType, isVariable } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { mergeObjectTypes } from './internal/object_types'
import { mergeInstances } from './internal/instances'
import { mergeVariables } from './internal/variables'
import { mergePrimitives } from './internal/primitives'
import { MergeResult as InternalMergeResult } from './internal/common'

export { MergeError, DuplicateAnnotationError } from './internal/common'
export type MergeResult = InternalMergeResult<Element[]>

const log = logger(module)

export const mergeElements = (elements: ReadonlyArray<Element>): MergeResult => {
  log.debug('starting to merge %d elements', elements.length)
  const objects = mergeObjectTypes(elements.filter(isObjectType))
  const instances = mergeInstances(elements.filter(isInstanceElement))
  const primitives = mergePrimitives(elements.filter(isPrimitiveType))
  const variables = mergeVariables(elements.filter(isVariable))

  const merged = [
    ...elements.filter(e => !isObjectType(e) && !isInstanceElement(e) && !isVariable(e)),
    ...Object.values(objects.merged),
    ...instances.merged,
    ...variables.merged,
    ...Object.values(primitives.merged),
  ]

  const errors = [
    ...objects.errors,
    ...instances.errors,
    ...primitives.errors,
    ...variables.errors,
  ]

  log.debug(`merged ${elements.length} elements to ${merged.length} elements [errors=${
    errors.length}]`)
  if (errors.length > 0) {
    log.debug(`All merge errors:\n${errors.map(err => err.message).join('\n')}`)
  }
  return {
    merged,
    errors,
  }
}
