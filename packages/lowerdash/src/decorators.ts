import { fromPairs } from 'lodash'

export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

export type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>> & { name: string }
export type Method<T> = (this: T, ...args: unknown[]) => unknown
export type Decorator<T> = (
  this: T, originalMethod: Method<T>, ...originalArgs: unknown[]
) => unknown

export const applyDecorator = <T extends { [K in keyof T]: T[K] }, TClass extends { prototype: T }>(
  clazz: TClass,
  decorator: Decorator<T>,
  onlyMethodNames?: FunctionPropertyNames<T>[]
): void => {
  const { prototype } = clazz

  const methodNames = onlyMethodNames || (
    Object.getOwnPropertyNames(prototype) as FunctionPropertyNames<T>[]
  ).filter(f => f !== 'constructor')

  const methods: Method<T>[] = methodNames.map(name => prototype[name]) as Method<T>[]

  Object.assign(
    clazz.prototype,
    fromPairs(methods.map(method => [
      method.name,
      function execDecorator(this: T, ...originalArgs: unknown[]): unknown {
        return decorator.apply(this, [method, ...originalArgs])
      },
    ]))
  )
}
