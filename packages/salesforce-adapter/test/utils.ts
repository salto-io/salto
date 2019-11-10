import { Element, ElemID } from 'adapter-api'
import * as constants from '../src/constants'

export const findElements = (
  elements: ReadonlyArray<Element>,
  ...name: ReadonlyArray<string>
): Element[] => {
  const expectedElemId = name.length === 1
    ? new ElemID(constants.SALESFORCE, name[0])
    : new ElemID(constants.SALESFORCE, name[0], 'instance', ...name.slice(1))
  return elements.filter(e => e.elemID.getFullName() === expectedElemId.getFullName())
}
