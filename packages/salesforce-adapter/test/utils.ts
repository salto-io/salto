import { Element, ElemID } from 'adapter-api'
import * as constants from '../src/constants'

export const findElements = (
  elements: ReadonlyArray<Element>,
  ...name: ReadonlyArray<string>
): Element[] => elements.filter(
  e => e.elemID.getFullName() === new ElemID(constants.SALESFORCE, ...name).getFullName(),
)
