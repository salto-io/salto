import { applyDecorator, Decorator, Method } from '../src/decorators'

describe('decorators', () => {
  describe('when applied to some methods of a class', () => {
    class MyClass {
      constructor(public value: number) { }

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      foo(): void {
        this.value += 1
      }

      bar(p1: number, p2: string): Promise<string> {
        return Promise.resolve(`${p1}_${p2}_${this.value}`)
      }

      // eslint-disable-next-line class-methods-use-this
      possiblyNotDecorated(p1: number): number {
        return p1 * this.value
      }
    }

    const decorator: Decorator<MyClass> = jest.fn(
      function myDecorator(this: MyClass, f: Method<MyClass>, ...originalArgs: unknown[]): unknown {
        const result = f.apply(this, originalArgs)
        return typeof result === 'number' ? result * 100 : result
      }
    )

    let myInstance: MyClass
    let originalFoo: Method<MyClass>
    let originalBar: Method<MyClass>

    beforeAll(() => {
      originalFoo = MyClass.prototype.foo
      originalBar = MyClass.prototype.bar as Method<MyClass>
      applyDecorator(MyClass, decorator, ['foo', 'bar'])
    })

    beforeEach(() => {
      (decorator as jest.Mock).mockClear()
      myInstance = new MyClass(12)
    })

    it('applies the decorator on a method with no args and return value', () => {
      myInstance.foo()
      expect(decorator).toHaveBeenCalledWith(originalFoo)
      expect(myInstance.value).toBe(13)
    })

    it('applies the decorator on a method with args and return value', async () => {
      const result = await myInstance.bar(42, 'theresult')
      expect(result).toBe('42_theresult_12')
      expect(decorator).toHaveBeenCalledWith(originalBar, 42, 'theresult')
    })

    it('does not apply the decorator on a method which was not specified', () => {
      myInstance.possiblyNotDecorated(2)
      expect(decorator).not.toHaveBeenCalled()
    })
  })

  describe('when applied to all methods of a class', () => {
    class MyClass {
      constructor(public value: number) { }

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      foo(): void {
        this.value += 1
      }

      bar(p1: number, p2: string): Promise<string> {
        return Promise.resolve(`${p1}_${p2}_${this.value}`)
      }

      // eslint-disable-next-line class-methods-use-this
      possiblyNotDecorated(p1: number): number {
        return p1 * this.value
      }
    }

    const decorator: Decorator<MyClass> = jest.fn(
      function myDecorator(this: MyClass, f: Method<MyClass>, ...originalArgs: unknown[]): unknown {
        const result = f.apply(this, originalArgs)
        return typeof result === 'number' ? result * 100 : result
      }
    )

    let myInstance: MyClass
    let originalFoo: Method<MyClass>
    let originalBar: Method<MyClass>
    let originalPossiblyNotDecorated: Method<MyClass>

    beforeAll(() => {
      originalFoo = MyClass.prototype.foo
      originalBar = MyClass.prototype.bar as Method<MyClass>
      originalPossiblyNotDecorated = MyClass.prototype.possiblyNotDecorated as Method<MyClass>
      applyDecorator(MyClass, decorator)
    })

    beforeEach(() => {
      (decorator as jest.Mock).mockClear()
      myInstance = new MyClass(12)
    })

    it('applies the decorator on a method with no args and return value', () => {
      myInstance.foo()
      expect(decorator).toHaveBeenCalledWith(originalFoo)
      expect(myInstance.value).toBe(13)
    })

    it('applies the decorator on a method with args and return value', async () => {
      const result = await myInstance.bar(42, 'theresult')
      expect(result).toBe('42_theresult_12')
      expect(decorator).toHaveBeenCalledWith(originalBar, 42, 'theresult')
    })

    it('also applies the decorator on the third method', () => {
      expect(myInstance.possiblyNotDecorated(2)).toBe(2400)
      expect(decorator).toHaveBeenCalledWith(originalPossiblyNotDecorated, 2)
    })
  })
})
