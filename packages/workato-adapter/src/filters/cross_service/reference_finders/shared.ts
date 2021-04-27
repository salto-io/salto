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
import { InstanceElement, ElemID, ReferenceExpression, Value, Values } from '@salto-io/adapter-api'
import { transformElement, TransformFunc, safeJsonStringify, setPath, extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { types } from '@salto-io/lowerdash'
import { NetsuiteBlock, SalesforceBlock } from './recipe_block_types'

const log = logger(module)

export type MappedReference = {
  srcPath: ElemID | undefined
  ref: ReferenceExpression
}

export type ReferenceFinder<T extends SalesforceBlock | NetsuiteBlock> = (
  value: T,
  path: ElemID,
) => MappedReference[]

export type FormulaReferenceFinder = (
  value: string,
  path: ElemID,
) => MappedReference[]

export const addReferencesForService = <T extends SalesforceBlock | NetsuiteBlock>(
  inst: InstanceElement,
  appName: string,
  typeGuard: (value: Value, appName: string) => value is T,
  addReferences: ReferenceFinder<T>,
  addFormulaReferences?: FormulaReferenceFinder,
): void => {
  const dependencyMapping: MappedReference[] = []

  const findReferences: TransformFunc = ({ value, path }) => {
    if (typeGuard(value, appName)) {
      dependencyMapping.push(...addReferences(
        value,
        path ?? inst.elemID,
      ))
    }
    if (
      addFormulaReferences !== undefined
      && path !== undefined
      && _.isString(value)
    ) {
      dependencyMapping.push(...addFormulaReferences(value, path))
    }
    return value
  }

  // used for traversal, the transform result is ignored
  transformElement({
    element: inst,
    transformFunc: findReferences,
    strict: false,
  })
  if (dependencyMapping.length === 0) {
    return
  }
  log.debug('found the following references: %s', safeJsonStringify(dependencyMapping.map(dep => [dep.srcPath?.getFullName(), dep.ref.elemId.getFullName()])))
  dependencyMapping.forEach(({ srcPath, ref }) => {
    if (srcPath !== undefined) {
      setPath(inst, srcPath, ref)
    }
  })
  extendGeneratedDependencies(inst, dependencyMapping.map(dep => dep.ref))
}

export type Matcher<T> = (value: string) => Iterable<T>
export const createMatcher = <T>(
  matchers: RegExp[],
  typeGuard: types.TypeGuard<Values, T>,
): Matcher<T> => (
    function *fieldMatcher(value) {
      // replacement for string.prototype.matchAll which is not supported yet in node -
      // the matcher.exec() calls maintain the context when the regexes are global
      for (const matcher of matchers) {
        while (true) {
          const match = matcher.exec(value)?.groups
          if (match === undefined || match === null) {
            break
          }
          if (typeGuard(match)) {
            yield match
          }
        }
      }
    }
  )
