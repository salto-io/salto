/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { isCustom, isCustomObject } from '../transformers/transformer'
import { FilterWith } from '../filter'
import { getObjectDirectoryPath } from './custom_objects'

const { awu } = collections.asynciterable

export const annotationsFileName = (objectName: string): string => `${pathNaclCase(objectName)}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}CustomFields`

const createCustomFieldsObject = (customObject: ObjectType): ObjectType => {
  const customFields = _.pickBy(
    customObject.fields,
    f => isCustom(f.elemID.getFullName())
  )
  return new ObjectType(
    {
      elemID: customObject.elemID,
      fields: customFields,
      path: [
        ...getObjectDirectoryPath(customObject),
        customFieldsFileName(customObject.elemID.name),
      ],
    }
  )
}

const customObjectToSplitElements = async (customObject: ObjectType): Promise<ObjectType[]> => {
  const annotationsObject = new ObjectType({
    elemID: customObject.elemID,
    annotationRefsOrTypes: customObject.annotationRefTypes,
    annotations: customObject.annotations,
    path: [
      ...getObjectDirectoryPath(customObject),
      annotationsFileName(customObject.elemID.name),
    ],
  })
  const standardFieldsObject = new ObjectType({
    elemID: customObject.elemID,
    fields: _.pickBy(customObject.fields, f => !isCustom(f.elemID.getFullName())),
    path: [
      ...getObjectDirectoryPath(customObject),
      standardFieldsFileName(customObject.elemID.name),
    ],
  })
  const customFieldsObject = createCustomFieldsObject(customObject)
  return [customFieldsObject, standardFieldsObject, annotationsObject]
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = await awu(elements).filter(isCustomObject).toArray() as ObjectType[]
    const newSplitCustomObjects = await awu(customObjects)
      .flatMap(customObjectToSplitElements)
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
