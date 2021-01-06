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
import { Element, ObjectType, Field } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { isCustomObject, isCustom, relativeApiName } from '../transformers/transformer'
import { FilterWith } from '../filter'
import { API_NAME } from '../constants'
import { getNamespace, getNamespaceFromString } from './utils'
import { getObjectDirectoryPath } from './custom_objects'

export const annotationsFileName = (objectName: string): string => `${pathNaclCase(objectName)}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}CustomFields`

const createCustomFieldsObjects = (customObject: ObjectType): ObjectType[] => {
  const createCustomFieldObject = (fields: Record<string, Field>, namespace?: string): ObjectType =>
    (new ObjectType(
      {
        elemID: customObject.elemID,
        fields,
        path: [
          ...getObjectDirectoryPath(customObject, namespace),
          customFieldsFileName(customObject.elemID.name),
        ],
      }
    ))
  const customFields = _.pickBy(
    customObject.fields,
    f => isCustom(f.elemID.getFullName())
  )

  // When there's an object namespace, all the custom fields are in the same object
  const objNamespace = getNamespace(customObject)
  if (!_.isUndefined(objNamespace) && !_.isEmpty(customFields)) {
    return [createCustomFieldObject(customFields, objNamespace)]
  }

  const getFieldDefNamespace = (f: Field): string | undefined => (
    getNamespaceFromString(relativeApiName(f.annotations?.[API_NAME] ?? ''))
  )
  const packagedFields = _.pickBy(customFields, f => getFieldDefNamespace(f) !== undefined)
  const regularCustomFields = _.pickBy(customFields, f => getFieldDefNamespace(f) === undefined)
  const namespaceToFields = _.mapValues(
    _.groupBy(packagedFields, (field: Field) => getFieldDefNamespace(field)),
    (fields: Field[]) => _.keyBy(fields, 'name')
  )

  // Custom fields that belong to a package go in a separate element
  const customFieldsObjects = Object.entries(namespaceToFields)
    .map(([fieldNamespace, packageFields]) =>
      createCustomFieldObject(packageFields, fieldNamespace))

  if (!_.isEmpty(regularCustomFields)) {
    // Custom fields that has no namespace go in a separate element
    const customPart = createCustomFieldObject(regularCustomFields)
    customFieldsObjects.push(customPart)
  }
  return customFieldsObjects
}

const customObjectToSplittedElements = (customObject: ObjectType): ObjectType[] => {
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
  const customFieldsObjects = createCustomFieldsObjects(customObject)
  return [...customFieldsObjects, standardFieldsObject, annotationsObject]
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = elements.filter(isCustomObject)
    const newSplittedCustomObjects = _.flatten(customObjects.map(customObjectToSplittedElements))
    _.pullAllWith(
      elements,
      customObjects,
      (elementA: Element, elementB: Element): boolean =>
        (isCustomObject(elementA) && isCustomObject(elementB) && elementA.isEqual(elementB))
    )
    elements.push(...newSplittedCustomObjects)
  },
})

export default filterCreator
