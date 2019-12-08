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
        expect(() => wrapped({ n: 'foo' } as unknown as MyOpts))
          .toThrow(/n should be undefined or a number, received: 'foo'/)
      })
    })
  })
})
