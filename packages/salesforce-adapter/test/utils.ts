import { Element, ElemID, findElements as findElementsByID, Values } from 'adapter-api'
import * as constants from '../src/constants'

export const findElements = (
  elements: ReadonlyArray<Element>,
  ...name: ReadonlyArray<string>
): Element[] => {
  const expectedElemId = name.length === 1
    ? new ElemID(constants.SALESFORCE, name[0])
    : new ElemID(constants.SALESFORCE, name[0], 'instance', ...name.slice(1))
  return [...findElementsByID(elements, expectedElemId)]
}

export const createValueSetEntry = (name: string, defaultValue = false, label?: string): Values =>
  ({ [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: name,
    [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: label || name,
    [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: defaultValue })
