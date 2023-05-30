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
import { Change, DeployResult, ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { objects } from '@salto-io/lowerdash'
import each from 'jest-each'
import { Filter, FilterCreator, FilterMetadata, filtersRunner, FilterWith } from '../src/filter'

const { concatObjects } = objects

describe('filtersRunner', () => {
  describe('onFetch', () => {
    type FetchResult = { a: number[] }
    let onFetchResults: FetchResult | void
    const onFetch1 = jest.fn()
    const onFetch2 = jest.fn()

    beforeEach(async () => {
      jest.resetAllMocks()
      onFetch1.mockResolvedValue({ a: [1] })
      onFetch2.mockResolvedValue({ a: [2] })

      const filters = [onFetch1, onFetch2]
        .map(f => () => ({ onFetch: f })) as unknown as FilterCreator<FetchResult, {}>[]

      onFetchResults = await filtersRunner({}, filters, concatObjects).onFetch([])
    })

    it('should run onFetchAggregator the results', () => {
      expect(onFetchResults).toEqual({ a: [1, 2] })
    })
  })

  each([
    'onFetch',
    'preDeploy',
    'onDeploy',
    'onPostFetch',
  ]).describe('%s', (operation: keyof Omit<Filter<void>, keyof FilterMetadata>) => {
    const operation1 = jest.fn()
    const operation2 = jest.fn()
    let filterRunnerPromise: Promise<unknown>

    beforeEach(async () => {
      jest.resetAllMocks()
      operation1.mockResolvedValue(undefined)
      operation2.mockResolvedValue(undefined)
    })

    it(`should run all ${operation} filters in order`, async () => {
      const operations = [operation1, operation2]
      const filters = operations
        .map(f => () => ({ [operation]: f, name: 'bla' }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterRunnerPromise = filtersRunner({}, filters)[operation]({} as any)
      const orderedOperations = operation === 'preDeploy' ? [...operations].reverse() : operations

      expect(orderedOperations[0]).toHaveBeenCalled()
      expect(orderedOperations[1]).not.toHaveBeenCalled()
      await filterRunnerPromise
      expect(orderedOperations[1]).toHaveBeenCalled()
    })
  })

  describe('deploy', () => {
    let filterRes: { leftoverChanges: Change[]; deployResult: DeployResult }

    beforeEach(async () => {
      const filter: FilterWith<{}, 'deploy'> = {
        name: 'deployTestFilter',
        deploy: async changes => ({
          deployResult: {
            appliedChanges: [changes[0]],
            errors: [new Error(changes.length.toString())],
          },
          leftoverChanges: changes.slice(1),
        }),
      }

      const filterRunner = filtersRunner({}, [() => filter, () => filter])
      const typeChange = toChange({ after: new ObjectType({ elemID: new ElemID('adapter', 'type') }) })
      filterRes = await filterRunner.deploy([typeChange, typeChange, typeChange])
    })

    it('should return the changes that were not deployed', () => {
      expect(filterRes.leftoverChanges).toHaveLength(1)
    })

    it('should return the merged deploy results', () => {
      expect(filterRes.deployResult.appliedChanges).toHaveLength(2)
      expect(filterRes.deployResult.errors).toEqual([new Error('3'), new Error('2')])
    })
  })
})
