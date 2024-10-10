/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { errors as wsErrors } from '@salto-io/workspace'
import { SaltoError, ElemID } from '@salto-io/adapter-api'
import { groupRelatedErrors, UnresolvedReferenceGroupError } from '../../src/workspace/errors'

describe('groupRelatedErrors', () => {
  let nonGroupedError: SaltoError
  let originalErrors: ReadonlyArray<SaltoError>
  let groupedErrors: ReadonlyArray<SaltoError>
  beforeEach(() => {
    nonGroupedError = { severity: 'Error', message: 'test', detailedMessage: 'test' }
  })

  describe('group unresolved references by target', () => {
    const numSources = 10
    let sources: ElemID[]
    beforeEach(() => {
      sources = _.times(numSources).map(i => new ElemID('test', i.toString()))
    })
    describe('with references to the same target', () => {
      let target: ElemID
      beforeEach(() => {
        target = new ElemID('test', 'target')
        originalErrors = [
          nonGroupedError,
          ...sources.map(elemID => new wsErrors.UnresolvedReferenceValidationError({ elemID, target })),
        ]
        groupedErrors = groupRelatedErrors(originalErrors)
      })
      it('should group related errors', () => {
        expect(groupedErrors.length).toBeLessThan(originalErrors.length)
      })
      it('should keep non grouped errors unchanged', () => {
        expect(groupedErrors).toContain(nonGroupedError)
      })
      describe('UnresolvedReferenceGroupError', () => {
        let groupError: UnresolvedReferenceGroupError
        beforeEach(() => {
          groupError = groupedErrors.find(
            err => err instanceof UnresolvedReferenceGroupError,
          ) as UnresolvedReferenceGroupError
        })
        it('should be in the grouped errors', () => {
          expect(groupError).toBeDefined()
        })
        it('should contain the number of errors it grouped', () => {
          expect(groupError.message).toContain(numSources.toString())
        })
        it('should contain the target', () => {
          expect(groupError.message).toContain(target.getFullName())
        })
      })
    })

    describe('with references to targets nested in other targets', () => {
      let baseTarget: ElemID
      beforeEach(() => {
        baseTarget = new ElemID('test', 'target', 'field', 'bla')
        originalErrors = sources.map(
          (elemID, idx) =>
            new wsErrors.UnresolvedReferenceValidationError({
              elemID,
              target: baseTarget.createNestedID(..._.times(idx, () => 'a')),
            }),
        )
        groupedErrors = groupRelatedErrors(originalErrors)
      })
      it('should group to the outermost target', () => {
        expect(groupedErrors).toHaveLength(1)
        const [error] = groupedErrors
        expect(error).toBeInstanceOf(UnresolvedReferenceGroupError)
        expect(error.message).toContain(baseTarget.getFullName())
      })
    })

    describe('with a single unresolved reference', () => {
      let target: ElemID
      beforeEach(() => {
        target = new ElemID('test', 'target')
        originalErrors = [new wsErrors.UnresolvedReferenceValidationError({ elemID: sources[0], target })]
        groupedErrors = groupRelatedErrors(originalErrors)
      })
      it('should not create a group error', () => {
        expect(originalErrors).toEqual(groupedErrors)
      })
    })
  })
})
