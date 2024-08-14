/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type InstanceMethodDecorator = <T>(
  prototype: T,
  name: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor

export type OriginalCall = {
  call: () => unknown
  name: string
  args: unknown[]
}

/**
 * Creates an instance method decorator that wraps the original method call
 */
export const wrapMethodWith =
  <T>(decorator: (this: T, original: OriginalCall) => unknown): InstanceMethodDecorator =>
  (_prototype: unknown, name: string, descriptor: PropertyDescriptor): PropertyDescriptor => ({
    ...descriptor,
    value: function wrapped(this: T, ...args: unknown[]) {
      return decorator.call(this, { call: descriptor.value.bind(this, ...args), name, args })
    },
  })
