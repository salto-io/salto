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

/* eslint-disable no-bitwise */

import wu from 'wu'

export const MAX_HASH = 2 ** 31
export const MIN_HASH = -MAX_HASH

// Adapted from: https://github.com/darkskyapp/string-hash/blob/master/index.js
// License is checked and legit

export default (s: string): number =>
  wu(s)
    .map(c => c.charCodeAt(0))
    .reduce((res, code) => (res * 33) ^ code, 5381)
