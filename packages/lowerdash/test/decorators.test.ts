import { decorators } from '../src'

describe('decorators', () => {
  describe('wrapMethodWith', () => {
    const ensureFooIsCalled = jest.fn(
      async function ensureFooIsCalledImpl(
        this: MyClass, original: decorators.OriginalCall
      ): Promise<unknown> {
        this.foo()
        const originalResult = await original.call()
        return `${originalResult}_modified`
      }
    )
    const ensureFooIsCalledDecorator = decorators.wrapMethodWith(ensureFooIsCalled)

    class MyClass {
      constructor(public value: number) { }

      foo(): void {
        this.value += 1
      }

      @ensureFooIsCalledDecorator
      bar(p1: number, p2: string): Promise<string> {
        return Promise.resolve(`${p1}_${p2}_${this.value}`)
      }
    }

    let m: MyClass

    beforeEach(() => {
      ensureFooIsCalled.mockClear()
      m = new MyClass(12)
    })

    it('can call the original function and return its modified result', async () => {
      expect(await m.bar(14, 'hello')).toBe('14_hello_13_modified')
    })

    describe('the originalCall argument', () => {
      let originalCall: decorators.OriginalCall

      beforeEach(() => {
        m.bar(14, 'world');
        [[originalCall]] = ensureFooIsCalled.mock.calls
      })

      it('should have the name of the called method', () => {
        expect(originalCall.name).toBe('bar')
      })

      it('should have the arguments of the called method', () => {
        expect(originalCall.args).toEqual([14, 'world'])
      })

      it('should have the wrapped function', async () => {
        expect(typeof originalCall.call).toBe('function')
        expect(await originalCall.call()).toEqual('14_world_13')
      })
    })
  })
})
