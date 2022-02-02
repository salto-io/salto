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
import { loadSwagger } from '../../../src/elements/swagger'


const mockBundle = jest.fn()

jest.mock('@apidevtools/swagger-parser', () =>
  jest.fn().mockImplementation(
    () => ({ bundle: mockBundle })
  ))

describe('loadSwagger', () => {
  beforeEach(() => {
    mockBundle.mockClear()
  })
  it('should retry when failing', async () => {
    mockBundle.mockRejectedValueOnce(new Error('Failed to load swagger'))
    await loadSwagger('url')
    expect(mockBundle).toHaveBeenCalledTimes(2)
  })

  it('should throw if failed after retries', async () => {
    mockBundle.mockRejectedValue(new Error('Failed to load swagger'))
    await expect(loadSwagger('url')).rejects.toThrow()
    expect(mockBundle).toHaveBeenCalledTimes(6)
  })
})
