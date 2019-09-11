import {
  isObjectType, Type, InstanceElement,
} from 'adapter-api'

/**
 * Compare two types and expect them to be the same.
 * This is slightly different than just deep equality because
 * in fields and annotations we only exepct the type ID to match
 */
export const expectTypesToMatch = (actual: Type, expected: Type): void => {
  expect(typeof actual).toBe(typeof expected)
  expect(actual.elemID).toEqual(expected.elemID)
  expect(actual.annotationValues).toEqual(expected.annotationValues)

  // Check annotations match
  expect(Object.keys(actual.annotations)).toEqual(Object.keys(expected.annotations))
  Object.keys(expected.annotations).forEach(
    key => expect(actual.annotations[key].elemID).toEqual(expected.annotations[key].elemID)
  )

  // Check fields match
  if (isObjectType(expected) && isObjectType(actual)) {
    expect(Object.keys(actual.fields)).toEqual(Object.keys(expected.fields))

    Object.values(expected.fields).forEach(expectedField => {
      expect(actual.fields).toHaveProperty(expectedField.name)
      const actualField = actual.fields[expectedField.name]

      expect(actualField.elemID).toEqual(expectedField.elemID)
      expect(actualField.name).toEqual(expectedField.name)
      expect(actualField.annotationValues).toEqual(expectedField.annotationValues)
      expect(actualField.type.elemID).toEqual(expectedField.type.elemID)
    })
  }
}

/**
 * Compare two instance elements and expect them to be the same.
 * This is slightly different than just deep equality beacuse we only expect
 * the type ID to match and not the whole type instance
 */
export const expectInstancesToMatch = (
  expected: InstanceElement,
  actual: InstanceElement
): void => {
  expect(expected.elemID).toEqual(actual.elemID)
  expect(expected.value).toEqual(actual.value)
  expect(expected.type.elemID).toEqual(actual.type.elemID)
}
