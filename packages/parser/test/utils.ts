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
import { InstanceElement, isObjectType, TypeElement, Value } from '@salto-io/adapter-api'
import { Functions, FunctionImplementation, FunctionExpression } from '../src/parser/functions'

export class TestFuncImpl extends FunctionExpression {}

const registerFunction = (
  funcName: string,
  func: FunctionImplementation,
  functions: Functions = {},
  aliases: string[] = [],
): Functions => ({
  ...functions,
  ...[funcName].concat(aliases).reduce(
    (acc, alias: string) => ({
      ...acc,
      ...{
        [alias]: func,
      },
    }),
    {},
  ),
})

export const registerTestFunction = (funcName: string, aliases: string[] = [], functions: Functions = {}): Functions =>
  registerFunction(
    funcName,
    {
      parse: (parameters: Value[]) => Promise.resolve(new TestFuncImpl(funcName, parameters)),
      dump: (val: Value) => Promise.resolve(new FunctionExpression(funcName, val.parameters)),
      isSerializedAsFunction: (val: Value) => val instanceof TestFuncImpl,
    },
    functions,
    aliases,
  )

export const registerThrowingFunction = (funcName: string, parse: () => Promise<void>): Functions =>
  registerFunction(funcName, {
    parse,
    dump: () => Promise.reject(),
    isSerializedAsFunction: () => true,
  })

/**
 * Compare two instance elements and expect them to be the same.
 * This is slightly different than just deep equality because we only expect
 * the type ID to match and not the whole type instance
 */
export const expectInstancesToMatch = (expected: InstanceElement, actual: InstanceElement): void => {
  expect(expected.elemID).toEqual(actual.elemID)
  expect(expected.value).toEqual(actual.value)
  expect(expected.refType.elemID).toEqual(actual.refType.elemID)
  expect(expected.annotations).toEqual(actual.annotations)
}

/**
 * Compare two types and expect them to be the same.
 * This is slightly different than just deep equality because
 * in fields and annotations we only expect the type ID to match
 */
export const expectTypesToMatch = (actual: TypeElement, expected: TypeElement): void => {
  expect(typeof actual).toBe(typeof expected)
  expect(actual.elemID).toEqual(expected.elemID)
  expect(actual.annotations).toEqual(expected.annotations)

  // Check annotations match
  expect(Object.keys(actual.annotationRefTypes)).toEqual(Object.keys(expected.annotationRefTypes))
  Object.keys(expected.annotationRefTypes).forEach(key =>
    expect(actual.annotationRefTypes[key].elemID).toEqual(expected.annotationRefTypes[key].elemID),
  )

  // Check fields match
  if (isObjectType(expected) && isObjectType(actual)) {
    expect(Object.keys(actual.fields)).toEqual(Object.keys(expected.fields))

    Object.values(expected.fields).forEach(expectedField => {
      expect(actual.fields).toHaveProperty(expectedField.name)
      const actualField = actual.fields[expectedField.name]

      expect(actualField.elemID).toEqual(expectedField.elemID)
      expect(actualField.name).toEqual(expectedField.name)
      expect(actualField.annotations).toEqual(expectedField.annotations)
      expect(actualField.refType.elemID).toEqual(expectedField.refType.elemID)
    })
  }
}
