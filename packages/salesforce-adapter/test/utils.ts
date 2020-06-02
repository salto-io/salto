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
import _ from 'lodash'
import {
  Element, ElemID, Values, ObjectType,
} from '@salto-io/adapter-api'
import {
  findElements as findElementsByID,
} from '@salto-io/adapter-utils'
import JSZip from 'jszip'
import * as constants from '../src/constants'
import {
  annotationsFileName, customFieldsFileName, standardFieldsFileName,
} from '../src/filters/custom_object_split'

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

export const findCustomFieldsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === customFieldsFileName(name)) as ObjectType
}

export const findStandardFieldsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === standardFieldsFileName(name)) as ObjectType
}

export const findAnnotationsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === annotationsFileName(name)) as ObjectType
}
