/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

      const filters = [onFetch1, onFetch2].map(f => () => ({ onFetch: f })) as unknown as FilterCreator<
        FetchResult,
        {}
      >[]

      onFetchResults = await filtersRunner({}, filters, concatObjects).onFetch([])
    })

    it('should run onFetchAggregator the results', () => {
      expect(onFetchResults).toEqual({ a: [1, 2] })
    })
  })

  each(['onFetch', 'preDeploy', 'onDeploy', 'onPostFetch']).describe(
    '%s',
    (operation: keyof Omit<Filter<void>, keyof FilterMetadata>) => {
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
        const filters = operations.map(f => () => ({ [operation]: f, name: 'bla' }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filterRunnerPromise = filtersRunner({}, filters)[operation]({} as any, undefined)
        const orderedOperations = operation === 'preDeploy' ? [...operations].reverse() : operations

        expect(orderedOperations[0]).toHaveBeenCalled()
        expect(orderedOperations[1]).not.toHaveBeenCalled()
        await filterRunnerPromise
        expect(orderedOperations[1]).toHaveBeenCalled()
      })
    },
  )

  describe('deploy', () => {
    let filterRes: { leftoverChanges: Change[]; deployResult: DeployResult }
    let allChanges: Change[]
    let filterRunner: Required<Filter<{}, void>>

    beforeEach(async () => {
      const typeChange = toChange({ after: new ObjectType({ elemID: new ElemID('adapter', 'type') }) })
      allChanges = [typeChange, typeChange, typeChange]
      const filter: FilterWith<{}, 'deploy'> = {
        name: 'deployTestFilter',
        deploy: async (changes, changeGroup) => ({
          deployResult: {
            appliedChanges: [changes[0]],
            errors: [
              {
                message: `${changeGroup?.groupID}/${changes.length.toString()}`,
                severity: 'Error',
                detailedMessage: '',
              },
            ],
          },
          leftoverChanges: changes.slice(1),
        }),
      }

      filterRunner = filtersRunner({}, [() => filter, () => filter])
    })
    describe('with change group', () => {
      beforeEach(async () => {
        filterRes = await filterRunner.deploy(allChanges, { changes: allChanges, groupID: 'abc' })
      })

      it('should return the changes that were not deployed', () => {
        expect(filterRes.leftoverChanges).toHaveLength(1)
      })

      it('should return the merged deploy results', () => {
        expect(filterRes.deployResult.appliedChanges).toHaveLength(2)
        expect(filterRes.deployResult.errors).toEqual([
          expect.objectContaining({
            message: expect.stringContaining('3'),
            severity: 'Error',
          }),
          expect.objectContaining({
            message: expect.stringContaining('2'),
            severity: 'Error',
          }),
        ])
        expect(filterRes.deployResult.errors.map(e => e.message)).toEqual([
          expect.stringContaining('abc/'),
          expect.stringContaining('abc/'),
        ])
      })
    })
    // TODO remove when change group becomes required in SALTO-5531
    describe('without change group', () => {
      beforeEach(async () => {
        filterRes = await filterRunner.deploy(allChanges)
      })

      it('should return the changes that were not deployed', () => {
        expect(filterRes.leftoverChanges).toHaveLength(1)
      })

      it('should return the merged deploy results', () => {
        expect(filterRes.deployResult.appliedChanges).toHaveLength(2)
        expect(filterRes.deployResult.errors).toEqual([
          expect.objectContaining({
            message: expect.stringContaining('3'),
            severity: 'Error',
          }),
          expect.objectContaining({
            message: expect.stringContaining('2'),
            severity: 'Error',
          }),
        ])
        expect(filterRes.deployResult.errors.map(e => e.message)).toEqual([
          expect.stringContaining('undefined/'),
          expect.stringContaining('undefined/'),
        ])
      })
    })
  })
})
