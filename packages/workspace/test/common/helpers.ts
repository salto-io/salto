/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  isObjectType, TypeElement, InstanceElement,
} from '@salto-io/adapter-api'

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
  expect(
    Object.keys(actual.annotationRefTypes)
  ).toEqual(Object.keys(expected.annotationRefTypes))
  Object.keys(expected.annotationRefTypes).forEach(
    key => expect(
      actual.annotationRefTypes[key].elemID
    ).toEqual(expected.annotationRefTypes[key].elemID)
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

/**
 * Compare two instance elements and expect them to be the same.
 * This is slightly different than just deep equality because we only expect
 * the type ID to match and not the whole type instance
 */
export const expectInstancesToMatch = (
  expected: InstanceElement,
  actual: InstanceElement
): void => {
  expect(expected.elemID).toEqual(actual.elemID)
  expect(expected.value).toEqual(actual.value)
  expect(expected.refType.elemID).toEqual(actual.refType.elemID)
  expect(expected.annotations).toEqual(actual.annotations)
}

export const expectToContainAllItems = <T>(arr: T[], items: T[]): void => {
  items.forEach(item => expect(arr).toContain(item))
}

export const mockFunction = <T extends (...args: never[]) => unknown>():
jest.Mock<ReturnType<T>, Parameters<T>> => jest.fn()
