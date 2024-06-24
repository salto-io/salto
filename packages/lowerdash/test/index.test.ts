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
import * as lowerdash from '../src'

describe('index.ts', () => {
  it('should define the namespaces', () => {
    expect(lowerdash.collections).toBeDefined()
    expect(lowerdash.promises).toBeDefined()

    // test import of type SetId
    const t: lowerdash.collections.set.SetId = 1
    expect(t).toBe(1)
  })
})
