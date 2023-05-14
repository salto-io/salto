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
import _ from 'lodash'
import { errors as wsErrors } from '@salto-io/workspace'
import { SaltoError, ElemID } from '@salto-io/adapter-api'
import { groupRelatedErrors } from '../../src/workspace/errors'

describe('groupRelatedErrors', () => {
  let nonGroupedError: SaltoError
  let originalErrors: ReadonlyArray<SaltoError>
  let groupedErrors: ReadonlyArray<SaltoError>
  beforeEach(() => {
    nonGroupedError = { severity: 'Error', message: 'test' }
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
          ...sources.map(
            elemID => new wsErrors.UnresolvedReferenceValidationError({ elemID, target })
          ),
        ]
        groupedErrors = groupRelatedErrors(originalErrors)
      })
      it('should group related errors', () => {
        expect(groupedErrors.length).toBeLessThan(originalErrors.length)
      })
      it('should keep non grouped errors unchanged', () => {
        expect(groupedErrors).toContain(nonGroupedError)
      })
    })
  })
})
