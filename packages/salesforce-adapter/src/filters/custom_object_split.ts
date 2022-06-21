/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isCustom, isCustomObject, apiName } from '../transformers/transformer'
import { FilterWith, FilterCreator } from '../filter'
import { getObjectDirectoryPath } from './custom_objects'
import { OBJECT_FIELDS_PATH } from '../constants'

const { awu } = collections.asynciterable

export const annotationsFileName = (objectName: string): string => `${pathNaclCase(objectName)}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}CustomFields`
const perFieldFileName = (fieldName: string): string => pathNaclCase(fieldName)

const customObjectToSplitPaths = async (customObject: ObjectType, splitAllFields: string[]):
Promise<ObjectType> => {
  const pathPrefix = await getObjectDirectoryPath(customObject)
  const annotationsPath = [
    ...pathPrefix,
    annotationsFileName(customObject.elemID.name),
  ]
  const standardFieldsPath = [
    ...pathPrefix,
    standardFieldsFileName(customObject.elemID.name),
  ]
  const customFieldsPath = [
    ...pathPrefix,
    customFieldsFileName(customObject.elemID.name),
  ]
  const annotationToPath = Object.keys(customObject.annotations)
    .map(annotation => [
      customObject.elemID.createNestedID('attr', annotation).getFullName(),
      annotationsPath,
    ] as [string, string[]])
  const annotationTypeToPath = Object.keys(customObject.annotationRefTypes)
    .map(annotationType => [
      customObject.elemID.createNestedID('annotation', annotationType).getFullName(),
      annotationsPath,
    ] as [string, string[]])
  const shouldSplitFields = splitAllFields.includes(await apiName(customObject))
  const createPerFieldPath = (fieldName: string): string[] => [
    ...pathPrefix,
    OBJECT_FIELDS_PATH,
    perFieldFileName(fieldName),
  ]
  customObject.pathIndex = new collections.treeMap.TreeMap<string>([
    [customObject.elemID.getFullName(), annotationsPath],
    ...annotationToPath,
    ...annotationTypeToPath,
    ...Object.entries(customObject.fields)
      .map(([fieldName, field]) => {
        const groupedFieldsPath = isCustom(field.elemID.getFullName())
          ? customFieldsPath
          : standardFieldsPath
        return [
          field.elemID.getFullName(),
          shouldSplitFields ? createPerFieldPath(fieldName) : groupedFieldsPath,
        ] as [string, string[]]
      }),
  ])
  return customObject
}

const filterCreator: FilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = await awu(elements).filter(isCustomObject).toArray() as ObjectType[]
    const newSplitCustomObjects = await awu(customObjects)
      .map(customObject =>
        customObjectToSplitPaths(customObject, config.separateFieldToFiles ?? []))
      .toArray()
    _.pullAllWith(
      elements,
      customObjects,
      // No need to check for custom objectness since all of the elements in
      // the second params are custom objects.
      (elementA: Element, elementB: Element): boolean => isObjectType(elementA)
        && isObjectType(elementB)
        && elementA.isEqual(elementB)
    )
    const isNotEmptyObject = (customObject: ObjectType): boolean =>
      !(_.isEmpty(customObject.annotations) && _.isEmpty(customObject.fields))
    elements.push(...newSplitCustomObjects.filter(isNotEmptyObject))
  },
})

export default filterCreator
