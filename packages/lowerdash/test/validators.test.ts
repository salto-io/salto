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
import { validators, validate, Validator } from '../src/validators'

describe('validators', () => {
  describe('validators', () => {
    describe('greaterThan', () => {
      type MyOpts = {
        myNum: number
        myNum2: number
      }
      let validator: Validator<number, MyOpts>

      describe('when created with a number', () => {
        beforeEach(() => {
          validator = validators.greaterThan(12)
        })
        it('should throw when not greater than', () => {
          expect(() => validate(validator, 12)).toThrow(/should be greater than 12, received: 12/)
        })
        it('should throw when not a number', () => {
          expect(() => validate(validator, 'foo' as unknown as number)).toThrow(/should be a number, received: 'foo'/)
        })
        it('should not throw when valid', () => {
          expect(() => validate(validator, 13)).not.toThrow()
        })
      })

      describe('when created with a function returning number', () => {
        let opts: MyOpts

        beforeEach(() => {
          opts = { myNum: 1111, myNum2: 12 }
          validator = validators.greaterThan(o => o.myNum2)
        })

        it('should throw when not greater than', () => {
          opts.myNum = 12
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(/myNum should be greater than 12/)
        })

        it('should throw when not a number', () => {
          opts.myNum = 'foo' as unknown as number
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(/myNum should be a number/)
        })

        it('should not throw when valid', () => {
          opts.myNum = 13
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).not.toThrow()
        })
      })
    })

    describe('greaterOrEqualThan', () => {
      type MyOpts = {
        myNum: number
        myNum2: number
      }
      let validator: Validator<number, MyOpts>

      describe('when created with a number', () => {
        beforeEach(() => {
          validator = validators.greaterOrEqualThan(12)
        })
        it('should throw when not greater than', () => {
          expect(() => validate(validator, 11)).toThrow(/should be greater or equal than 12, received: 11/)
        })
        it('should throw when not a number', () => {
          expect(() => validate(validator, 'foo' as unknown as number)).toThrow(/should be a number, received: 'foo'/)
        })
        it('should not throw when valid', () => {
          expect(() => validate(validator, 12)).not.toThrow()
        })
      })

      describe('when created with a function returning number', () => {
        let opts: MyOpts

        beforeEach(() => {
          opts = { myNum: 1111, myNum2: 12 }
          validator = validators.greaterOrEqualThan(o => o.myNum2)
        })

        it('should throw when not greater than', () => {
          opts.myNum = 11
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(
            /myNum should be greater or equal than 12/,
          )
        })

        it('should throw when not a number', () => {
          opts.myNum = 'foo' as unknown as number
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(
            /myNum should be a number, received: 'foo'/,
          )
        })

        it('should not throw when valid', () => {
          opts.myNum = 12
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).not.toThrow()
        })
      })
    })

    describe('inRangeInclusive', () => {
      type MyOpts = {
        myNum: number
        min: number
        max: number
      }
      let validator: Validator<number, MyOpts>

      describe('when created with numbers', () => {
        beforeEach(() => {
          validator = validators.inRangeInclusive()([12, 13])
        })
        it('should throw when not in range', () => {
          expect(() => validate(validator, 11)).toThrow(/should be in range \[12, 13\], received: 11/)
        })
        it('should throw when not a number', () => {
          expect(() => validate(validator, 'foo' as unknown as number)).toThrow(/should be a number, received: 'foo'/)
        })
        it('should not throw when valid', () => {
          expect(() => validate(validator, 12)).not.toThrow()
        })
      })

      describe('when created with a function returning number', () => {
        let opts: MyOpts

        beforeEach(() => {
          opts = { myNum: 1111, min: 12, max: 13 }
          validator = validators.inRangeInclusive<MyOpts>()(o => [o.min, o.max])
        })

        it('should throw when not in range', () => {
          opts.myNum = 11
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(
            /myNum should be in range \[12, 13\], received: 11/,
          )
        })

        it('should throw when not a number', () => {
          opts.myNum = 'foo' as unknown as number
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).toThrow(
            /myNum should be a number, received: 'foo'/,
          )
        })

        it('should not throw when valid', () => {
          opts.myNum = 12
          expect(() => validate(validator, opts.myNum, 'myNum', opts)).not.toThrow()
        })
      })
    })

    describe('undefinedOr', () => {
      let validator: Validator<number | undefined>

      beforeEach(() => {
        validator = validators.undefinedOr(validators.greaterThan(10))
      })

      it('should throw when the value is a string', () => {
        expect(() => validate(validator, 'foo' as unknown as number)).toThrow(
          /should be undefined or a number, received: 'foo'/,
        )
      })

      it('should not throw when the value is undefined', () => {
        expect(() => validate(validator, undefined)).not.toThrow()
      })

      it('should not throw when the value is not undefined but valid', () => {
        expect(() => validate(validator, 11)).not.toThrow()
      })
    })
  })
})
