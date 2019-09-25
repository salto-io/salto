import { FunctionPropertyNames } from './types'

/*

decorate
--------

Replaces all or some methods of the specified class with a decorator function.
The decorator function accepts the original called function and arguments.

Some use cases:
- Log method call and arguments
- Transform method arguments or return value

Example 1: Log some method calls

// class ShouldBeLogged {
//   expensiveCall1(): { ... }
//   expensiveCall2(): { ... }
//   anotherCall(): { ... }
// }
//
// function logDecorator(
//   this: ShouldBeLogged, f: Method<ShouldBeLogged>, ...originalArgs: unknown[]
// ): unknown {
//   console.log(`${f.name}: entering, args: ${util.inspect(originalArgs)}`)
//   const returnValue = f.apply(this, originalArgs)
//   console.log(`${f.name}: exiting, returnValue: ${util.inspect(returnValue)}`)
//   return returnValue
// }
//
// // applies the decorator only on expensiveCall1 and expensiveCall2
// const Decorated = decorate(ShouldBeLogged, logDecorator, ['expensiveCall1', 'expensiveCall2'])
//
// const x = new Decorated(...)

Example 2: Change arguments

// class Greeter {
//   aloha(name: string): string {
//     return `aloha, ${name}!`
//   }
//   hello(name: string): string {
//     return `hello, ${name}!`
//   }
// }
//
// function formalizeGreeting(
//   this: Greeter, f: Method<Greeter>, ...originalArgs: unknown[]
// ): unknown {
//   const [ name ] = (originalArgs) as [string]
//   return (f.call(this, `Miss ${name}`) as string).replace('!', '')
// }
//
// // applies the decorator on all methods
// const DecoratedGreeter = decorate(Greeter, formalizeGreeting)
//
// const greeter = new DecoratedGreeter(...)

Example 3: Lazy login

// class BaseApiClient {
//   login(): void { ... }
//   callApi1(p1: number): string { ... }
//   callApi2(p1: string): void { ... }
// }
//
// function loginDecorator(
//   this: BaseApiClient, f: Method<BaseApiClient>, ...originalArgs: unknown[]
// ): unknown {
//   if (f.name !== 'login') {
//     this.login()
//   }
//   return f.apply(this, originalArgs)
// }
//
// const ApiClient = decorate(BaseApiClient, loginDecorator)

*/

export type Method<T> = (this: T, ...args: unknown[]) => unknown

export type Decorator<T> = (
  this: T, originalMethod: Method<T>, ...originalArgs: unknown[]
) => unknown

export const decorate = <
  T extends { [K in keyof T]: T[K] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TClass extends { new(...args: any[]): T },
>(
    clazz: TClass,
    decorator: Decorator<T>,
    onlyMethodNames?: FunctionPropertyNames<T>[]
  ): TClass => {
  const { prototype } = clazz

  const methodNames = onlyMethodNames || (
    Object.getOwnPropertyNames(prototype) as FunctionPropertyNames<T>[]
  ).filter(f => f !== 'constructor')

  // Ignore the following:
  // Base constructor return type 'T' is not an object type or intersection
  //  of object types with statically known members.ts(2509)
  // @ts-ignore
  const ResultClass = class extends clazz {}

  Object.assign(ResultClass.prototype, ...methodNames.map(methodName => ({
    [methodName]: function execDecorator(this: T, ...originalArgs: unknown[]): unknown {
      return decorator.apply(this, [prototype[methodName], ...originalArgs])
    },
  })))

  return ResultClass as TClass
}
