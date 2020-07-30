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
import { isPrimitive } from './values'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WalkCallback<Return> = (this: any, propName: string, propValue: unknown) => Return

// Walk the specified value, executing the callback function exactly once per property.
// The callback is given the property name and value as arguments,
// and the containing object as `this`.
export type Walker = (value: unknown, callback: WalkCallback<void>) => void

// If the callback function returns undefined, the property is deleted from the object.
// Otherwise, the property is redefined to be the return value.
export type MutatingWalker = (value: unknown, callback: WalkCallback<unknown>) => unknown

// Convert Walker to MutatingWalker
export const toMutating = (walk: Walker): Walker => (value, callback) => {
  walk(value, function mutatingWalker(propName, propValue): void {
    const mutation = callback.call(this, propName, propValue)

    if (mutation === undefined) {
      delete this[propName]
    } else {
      this[propName] = mutation
    }
  })

  return value
}

// Walk the specified value, beginning with the most nested properties and proceeding
// to the original value itself.
export const walkBottomUpDepthFirst: Walker = (value, callback) => {
  const visited = new Set<unknown>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(this: any, propName: string, propValue: unknown): void {
    const isPrimitiveProp = isPrimitive(propValue)

    if (!isPrimitiveProp) {
      if (visited.has(propValue)) {
        return
      }
      visited.add(propValue)
    }

    if (Array.isArray(propValue)) {
      propValue.forEach((v, i) => {
        walk.call(propValue, String(i), v)
      })
    } else if (!isPrimitiveProp) {
      Object.getOwnPropertyNames(propValue).forEach(p => {
        walk.call(propValue, p, (propValue as Record<string, unknown>)[p])
      })
    }

    callback.call(this, propName, propValue)
  }

  const topContext = { '': value }
  walk.call(topContext, '', topContext[''])
}

// Modeled after the JSON.parse reviver, described here: https://tc39.es/ecma262/#sec-json.parse
export const mutateBottomUpDepthFirst = toMutating(walkBottomUpDepthFirst)
