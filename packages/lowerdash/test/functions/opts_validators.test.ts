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
import { withOptsValidation, OptsValidators } from '../../src/functions/opts_validator'
import { validators } from '../../src/validators'

describe('optsValidator', () => {
  type MyOpts = {
    s: string
    n?: number
  }

  const myOptsValidators: OptsValidators<MyOpts> = {
    n: validators.undefinedOr(validators.number()),
  }

  let f: ((opts: MyOpts) => void) & jest.SpyInstance
  let wrapped: (opts: MyOpts) => void

  beforeEach(() => {
    f = jest.fn()
    wrapped = withOptsValidation(f, myOptsValidators)
  })

  describe('withOptsValidation', () => {
    describe('when all opts are valid', () => {
      it('does not throw', () => {
        expect(() => wrapped({ s: 'foo' })).not.toThrow()
      })
    })

    describe('when some opts are invalid', () => {
      it('does not throw', () => {
        expect(() => wrapped({ n: 'foo' } as unknown as MyOpts)).toThrow(
          /n should be undefined or a number, received: 'foo'/,
        )
      })
    })
  })
})
