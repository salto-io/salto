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
import { logger } from '@salto-io/logging'
import {
  Element, Field, isObjectType, ObjectType, InstanceElement, isInstanceElement, isField,
  TypeElement, BuiltinTypes, ElemID, CoreAnnotationTypes, TypeMap, INSTANCE_ANNOTATIONS,
  isReferenceExpression, ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { API_NAME, LABEL, CUSTOM_OBJECT,
  METADATA_TYPE, NAMESPACE_SEPARATOR, API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../constants'
import { JSONBool } from '../client/types'
import { isCustomObject, metadataType, apiName, defaultApiName } from '../transformers/transformer'

const log = logger(module)
const { makeArray } = collections.array

export const id = (elem: Element): string => elem.elemID.getFullName()

export const boolValue = (val: JSONBool):
 boolean => val === 'true' || val === true

export const getInstancesOfMetadataType = (elements: Element[], metadataTypeName: string):
 InstanceElement[] =>
  elements.filter(isInstanceElement)
    .filter(element => metadataType(element) === metadataTypeName)

export const getCustomObjects = (elements: Element[]): ObjectType[] =>
  elements
    .filter(isObjectType)
    .filter(isCustomObject)

// collect Object Type's elemID to api name as we have custom Object Types that are split and
// we need to know the api name to build full field name
export const generateObjectElemID2ApiName = (customObjects: ObjectType[]): Record<string, string> =>
  _(customObjects)
    .filter(obj => obj.annotations[API_NAME])
    .map(obj => [id(obj), obj.annotations[API_NAME]])
    .fromPairs()
    .value()

export const removeFieldsFromInstanceAndType = (elements: Element[], fieldNamesToDelete: string[],
  metadataTypeName: string): void => {
  getInstancesOfMetadataType(elements, metadataTypeName)
    .forEach(instance => fieldNamesToDelete
      .forEach(fieldNameToDelete => delete instance.value[fieldNameToDelete]))
  elements.filter(isObjectType)
    .filter(element => metadataType(element) === metadataTypeName)
    .forEach(elementType => fieldNamesToDelete
      .forEach(fieldNameToDelete => delete elementType.fields[fieldNameToDelete]))
}

export const addLabel = (elem: TypeElement | Field, label?: string): void => {
  const { name } = elem.elemID
  const { annotations } = elem
  if (!annotations[LABEL]) {
    annotations[LABEL] = label ?? name
    log.debug(`added LABEL=${annotations[LABEL]} to ${name}`)
  }
}

export const addApiName = (elem: TypeElement | Field, name?: string, parentName?: string):
void => {
  if (!elem.annotations[API_NAME]) {
    const newApiName = name ?? defaultApiName(elem)
    const fullApiName = parentName ? [parentName, newApiName].join(API_NAME_SEPERATOR) : newApiName
    elem.annotations[API_NAME] = fullApiName
    log.debug(`added API_NAME=${fullApiName} to ${elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationTypes[API_NAME]) {
    elem.annotationTypes[API_NAME] = BuiltinTypes.SERVICE_ID
  }
}

export const addMetadataType = (elem: ObjectType, metadataTypeValue = CUSTOM_OBJECT): void => {
  const { annotations, annotationTypes } = elem
  if (!annotationTypes[METADATA_TYPE]) {
    annotationTypes[METADATA_TYPE] = BuiltinTypes.SERVICE_ID
  }
  if (!annotations[METADATA_TYPE]) {
    annotations[METADATA_TYPE] = metadataTypeValue
    log.debug(`added METADATA_TYPE=${metadataTypeValue} to ${id(elem)}`)
  }
}

export const hasNamespace = (customElement: Field | ObjectType): boolean => (
  apiName(customElement) !== undefined
  && apiName(customElement, true).split(NAMESPACE_SEPARATOR).length === 3
)

export const getNamespace = (customElement: Field | ObjectType): string =>
  apiName(customElement, true).split(NAMESPACE_SEPARATOR)[0]

export const extractFullNamesFromValueList = (values: { [INSTANCE_FULL_NAME_FIELD]: string }[]):
  string[] =>
  values.map(v => v[INSTANCE_FULL_NAME_FIELD])


export const buildAnnotationsObjectType = (annotationTypes: TypeMap): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'AnnotationType')
  return new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(annotationTypes)
      .concat(Object.entries(CoreAnnotationTypes))
      .map(([k, v]) => ({ [k]: new Field(annotationTypesElemID, k, v) }))) })
}

export const generateApiNameToCustomObject = (elements: Element[]): Map<string, ObjectType> =>
  new Map(getCustomObjects(elements).map(obj => [apiName(obj), obj]))

export const addObjectParentReference = (instance: InstanceElement,
  { elemID: objectID }: ObjectType): void => {
  const instanceDeps = makeArray(instance.annotations[INSTANCE_ANNOTATIONS.PARENT])
  if (instanceDeps.filter(isReferenceExpression).some(ref => ref.elemId.isEqual(objectID))) {
    return
  }
  instanceDeps.push(new ReferenceExpression(objectID))
  instance.annotations[INSTANCE_ANNOTATIONS.PARENT] = instanceDeps
}
