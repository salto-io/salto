import { decorate, Method } from '../src/decorators'

describe('decorators', () => {
  class MyClass {
    constructor(public value: number) { }

    foo(): void {
      this.value += 1
    }

    bar(p1: number, p2: string): Promise<string> {
      return Promise.resolve(`${p1}_${p2}_${this.value}`)
    }

    possiblyNotDecorated(p1: number): number {
      return p1 * this.value
    }
  }

  function myDecorator(this: MyClass, f: Method<MyClass>, ...originalArgs: unknown[]): unknown {
    const result = f.apply(this, originalArgs)
    return typeof result === 'number' ? result * 100 : result
  }

  let myInstance: MyClass
  let decorator: jest.Mock

  describe('when applied to some methods of a class', () => {
    beforeEach(() => {
      decorator = jest.fn(myDecorator)
      const DecoratedClass = decorate(MyClass, decorator, ['foo', 'bar'])
      myInstance = new DecoratedClass(12)
    })

    it('applies the decorator on a method with no args and return value', () => {
      myInstance.foo()
      expect(decorator).toHaveBeenCalledWith(MyClass.prototype.foo)
      expect(myInstance.value).toBe(13)
    })

    it('applies the decorator on a method with args and return value', async () => {
      const result = await myInstance.bar(42, 'theresult')
      expect(result).toBe('42_theresult_12')
      expect(decorator).toHaveBeenCalledWith(MyClass.prototype.bar, 42, 'theresult')
    })

    it('does not apply the decorator on a method which was not specified', () => {
      myInstance.possiblyNotDecorated(2)
      expect(decorator).not.toHaveBeenCalled()
    })
  })

  describe('when applied to all methods of a class', () => {
    beforeEach(() => {
      decorator = jest.fn(myDecorator)
      const DecoratedClass = decorate(MyClass, decorator)
      myInstance = new DecoratedClass(12)
    })

    it('applies the decorator on a method with no args and return value', () => {
      myInstance.foo()
      expect(decorator).toHaveBeenCalledWith(MyClass.prototype.foo)
      expect(myInstance.value).toBe(13)
    })

    it('applies the decorator on a method with args and return value', async () => {
      const result = await myInstance.bar(42, 'theresult')
      expect(result).toBe('42_theresult_12')
      expect(decorator).toHaveBeenCalledWith(MyClass.prototype.bar, 42, 'theresult')
    })

    it('also applies the decorator on the third method', () => {
      expect(myInstance.possiblyNotDecorated(2)).toBe(2400)
      expect(decorator).toHaveBeenCalledWith(MyClass.prototype.possiblyNotDecorated, 2)
    })
  })
})
