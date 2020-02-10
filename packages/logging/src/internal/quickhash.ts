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

/* eslint-disable no-bitwise */

export const MAX_HASH = 2 ** 31
export const MIN_HASH = -MAX_HASH

// taken from: https://stackoverflow.com/a/8831937
export default (s: string): number => {
  let hash = 0

  for (let i = 0; i < s.length; i += 1) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash &= hash // Convert to 32bit integer
  }

  return hash
}
