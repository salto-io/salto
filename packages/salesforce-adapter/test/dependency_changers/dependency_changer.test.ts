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
import { DependencyChanger, DependencyChange, dependencyChange } from '@salto-io/adapter-api'
import { dependencyChangersRunner } from '../../src/dependency_changer'

describe('dependencyChangersRunner', () => {
  const mockDependencies = [dependencyChange('add', 1, 2), dependencyChange('add', 2, 3)]
  const mockChangers: ReadonlyArray<DependencyChanger> = [
    jest.fn().mockResolvedValue(mockDependencies.slice(0, 1)),
    jest.fn().mockResolvedValue(mockDependencies.slice(1)),
  ]
  let result: DependencyChange[]
  beforeEach(async () => {
    result = [...await dependencyChangersRunner(mockChangers)(new Map(), new Map())]
  })
  it('should run dependency changers', () => {
    mockChangers.forEach(changer => expect(changer).toHaveBeenCalled())
  })
  it('should chain the results of the dependency changers', () => {
    expect(result).toEqual(mockDependencies)
  })
})
