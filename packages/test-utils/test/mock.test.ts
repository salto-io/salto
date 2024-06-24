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
import { mockFunction } from '../src'

describe('mockFunction', () => {
  it('should create a jest mock function with proper type', () => {
    const func = mockFunction<(arg: number) => string>()
    // Note the mock implementation should enforce types here
    func.mockImplementation(num => num.toString())
    expect(jest.isMockFunction(func)).toBeTruthy()
  })
})
