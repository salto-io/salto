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
import { walkBottomUpDepthFirst } from './walker'

export const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'

export const insecureRandomString = (
  { length = 10, alphabet = DEFAULT_ALPHABET }: {
    length?: number
    alphabet?: string
  } = {},
): string => Array(...Array(length))
  .map(() => alphabet.charAt(Math.floor(Math.random() * alphabet.length)))
  .join('')

const collatorOptions = {
  locale: 'en',
  usage: 'sort',
  sensitivity: 'variant',
  ignorePunctuation: false,
  collation: 'default',
  numeric: false,
  caseFirst: 'false',
}

export const stableCollator = Intl.Collator(collatorOptions.locale, collatorOptions)

// This method solves a memory leak which takes place when we use slices
// from a large string in order to populate the strings in the elements.
// v8 will attempt to optimize the slicing operation by internally representing
// the slices string as a pointer to the large string with a start and finish indexes
// for the slice. As a result - the original string will not be evacuated from memory.
// to solve this we need to force v8 to change the sliced string representation to a
// regular string.
export const detachString = (s: string): string => Buffer.from(s).toString()

export const detachStrings = <T>(v: T): T => {
  walkBottomUpDepthFirst(
    v,
    function replacer(propName, propValue) {
      if (
        typeof propValue === 'string'
        /* istanbul ignore next */
        && Object.getOwnPropertyDescriptor(this, propName)?.writable
      ) {
        this[propName] = detachString(propValue)
      }
    },
  )

  return v
}
