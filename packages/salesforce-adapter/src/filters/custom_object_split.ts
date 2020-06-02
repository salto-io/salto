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
import { Element, ObjectType, isObjectType, Field } from '@salto-io/adapter-api'
import { isCustomObject, isCustom, relativeApiName } from '../transformers/transformer'
import { FilterWith } from '../filter'
import { SALESFORCE, INSTALLED_PACKAGES_PATH, OBJECTS_PATH, API_NAME } from '../constants'
import { getNamespace, getNamespaceFromString } from './utils'

export const annotationsFileName = (objectName: string): string => `${objectName}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${objectName}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${objectName}CustomFields`

const getObjectDirectoryPath = (obj: ObjectType, namespace?: string): string[] => {
  if (namespace) {
    return [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, obj.elemID.name]
  }
  return [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
}

const createCustomFieldsObjects = (
  customObject: ObjectType,
  objNamespace?: string
): ObjectType[] => {
  const createCustomFieldObject = (fields: Record<string, Field>, namespace?: string): ObjectType =>
    (new ObjectType(
      {
        elemID: customObject.elemID,
        fields,
        path: [...getObjectDirectoryPath(customObject, namespace),
          customFieldsFileName(customObject.elemID.name)],
      }
    ))
  const customFields = _.pickBy(
    customObject.fields,
    (f: Field) => isCustom(f.elemID.getFullName())
  ) as Record<string, Field>

  // When there's an object namespace, all the custom fields are in the same object
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
  const namespace = getNamespace(customObject)
  const annotationsObject = new ObjectType({
    elemID: customObject.elemID,
    annotationTypes: customObject.annotationTypes,
    annotations: customObject.annotations,
    path: [...getObjectDirectoryPath(customObject, namespace),
      annotationsFileName(customObject.elemID.name)],
  })
  const standardFieldsObject = new ObjectType({
    elemID: customObject.elemID,
    fields: _.pickBy(customObject.fields, (f: Field) => !isCustom(f.elemID.getFullName())),
    path: [...getObjectDirectoryPath(customObject, namespace),
      standardFieldsFileName(customObject.elemID.name)],
  })
  const customFieldsObjects = createCustomFieldsObjects(customObject, namespace)
  return [...customFieldsObjects, standardFieldsObject, annotationsObject]
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = elements.filter(isCustomObject).filter(isObjectType)
    const newSplittedCustomObjects = _.flatten(customObjects.map(customObjectToSplittedElements))
    _.pullAllWith(
      elements,
      customObjects,
      (elementA: Element, elementB: Element): boolean =>
        (isCustomObject(elementA) && isObjectType(elementA)
          && isCustomObject(elementB) && isObjectType(elementB) && elementA.isEqual(elementB))
    )
    elements.push(...newSplittedCustomObjects)
  },
})

export default filterCreator
