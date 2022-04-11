/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { filterErrorsBy } from '../src/errors'

describe('filterErrorsBy', () => {
  it('should return an error', async () => {
    const error = new Error('test')
    expect(await filterErrorsBy(() => Promise.reject(error), () => true)).toBe(error)
  })
  it('should throw an error', async () => {
    const error = new Error('test')
    await expect(filterErrorsBy(() => Promise.reject(error), () => false)).rejects.toThrow()
  })
})
