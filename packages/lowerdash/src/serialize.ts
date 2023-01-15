/*
*                      Copyright 2023 Salto Labs Ltd.
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


/**
 * avoid creating a single string for all items, which may exceed the max allowed string length.
 * currently only supports JSON.stringify - if cycles are possible, safeJsonStringify should be used instead.
 */
export async function *getSerializedStream(items: (unknown[] | Record<string, unknown>)[]): AsyncIterable<string> {
  let first = true
  yield '['
  for (const item of items) {
    if (first) {
      first = false
    } else {
      yield ','
    }
    // We don't use safeJsonStringify to save some time, because we know  we made sure there aren't
    // circles
    // eslint-disable-next-line no-restricted-syntax
    yield JSON.stringify(item)
  }
  yield ']'
}
