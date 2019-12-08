import { functions, validators as validatorUtils } from '../../src/index'

const { validators } = validatorUtils
const { defaultOpts } = functions

describe('defaultOpts', () => {
  describe('with no required args', () => {
    type MyOpts = {
      num: number
      stringOrUndefined?: string
    }

    let receivedOpts: MyOpts | undefined

    beforeEach(() => {
      receivedOpts = undefined
    })

    const f = defaultOpts((opts: MyOpts): void => {
      receivedOpts = opts // test what f actually receives
    }, {
      num: 12,
    })

    describe('when no opts are specified', () => {
      beforeEach(() => { f() })
      it('passes the default values', () => {
        const expectedOpts: MyOpts = { num: 12 }
        expect(receivedOpts).toEqual(expectedOpts)
      })
    })

    describe('when opts are specified', () => {
      describe('required opt', () => {
        beforeEach(() => { f({ num: 13 }) })
        it('passes the specified opt value', () => {
          const expectedOpts: MyOpts = { num: 13 }
          expect(receivedOpts).toEqual(expectedOpts)
        })
      })

      describe('optional opt', () => {
        beforeEach(() => { f({ num: 13, stringOrUndefined: 'x' }) })
        it('passes the specified opt value', () => {
          const expectedOpts: MyOpts = { num: 13, stringOrUndefined: 'x' }
          expect(receivedOpts).toEqual(expectedOpts)
        })
      })
    })

    describe('when validators are specified', () => {
      const fWithValidation = defaultOpts((opts: MyOpts): void => {
        receivedOpts = opts // test what f actually receives
      }, {
        num: 12,
      }, {
        num: validators.greaterOrEqualThan(10),
      })

      it('throws when some opts are not valid', () => {
        expect(() => fWithValidation({ num: 9 })).toThrow('num should be greater or equal than 10, received: 9')
      })

      it('does not throw when all opts valid', () => {
        expect(() => fWithValidation({ num: 10 })).not.toThrow()
      })
    })
  })

  describe('with required args', () => {
    type MyRequiredOpts = { requiredNum: number }
    type MyPartialOpts = { optionalString: string }
    type MyOpts = MyRequiredOpts & MyPartialOpts

    let receivedOpts: MyOpts | undefined

    beforeEach(() => {
      receivedOpts = undefined
    })

    const f = defaultOpts.withRequired<MyPartialOpts, MyRequiredOpts, void>(
      (opts: MyOpts): void => {
        receivedOpts = opts // test what f actually receives
      }, { optionalString: 'defaultString' }
    )

    describe('required opt', () => {
      beforeEach(() => {
        f({ requiredNum: 42 }) // must specify MyRequiredOpts
      })

      it('passes the specified opt value', () => {
        const expectedOpts: MyOpts = { requiredNum: 42, optionalString: 'defaultString' }
        expect(receivedOpts).toEqual(expectedOpts)
      })
    })

    describe('optional opt', () => {
      beforeEach(() => {
        f({ requiredNum: 42, optionalString: 'overrideString' })
      })
      it('passes the specified opt value', () => {
        const expectedOpts: MyOpts = { requiredNum: 42, optionalString: 'overrideString' }
        expect(receivedOpts).toEqual(expectedOpts)
      })
    })
  })
})
