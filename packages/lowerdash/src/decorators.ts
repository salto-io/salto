export type InstanceMethodDecorator = <T>(
  prototype: T,
  name: string,
  descriptor: PropertyDescriptor
) => PropertyDescriptor

export type OriginalCall = {
  call: () => unknown
  name: string
  args: unknown[]
}

/**
 * Creates an instance method decorator that wraps the original method call
 */
export const wrapMethodWith = <T>(
  decorator: (this: T, original: OriginalCall) => unknown,
): InstanceMethodDecorator => (
    _prototype: unknown,
    name: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => ({
    ...descriptor,
    value: function wrapped(this: T, ...args: unknown[]) {
      return decorator.call(this, { call: descriptor.value.bind(this, ...args), name, args })
    },
  })
