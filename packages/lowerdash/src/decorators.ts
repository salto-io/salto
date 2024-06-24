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
