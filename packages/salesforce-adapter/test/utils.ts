import _ from 'lodash'
import { Element, ElemID, findElements as findElementsByID, Values } from 'adapter-api'
import JSZip from 'jszip'
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

export const createValueSetEntry = (
  name: string,
  defaultValue = false,
  label?: string,
  isActive?: boolean,
  color?: string,
): Values => _.omitBy(
  {
    [constants.CUSTOM_VALUE.FULL_NAME]: name,
    [constants.CUSTOM_VALUE.LABEL]: label || name,
    [constants.CUSTOM_VALUE.DEFAULT]: defaultValue,
    isActive,
    color,
  },
  _.isUndefined
)

export type ZipFile = {
  path: string
  content: string
}

export const createEncodedZipContent = async (files: ZipFile[], encoding = 'base64'):
  Promise<string> => {
  const zip = new JSZip()
  files.forEach(file => zip.file(file.path, file.content))
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString(encoding)
}
