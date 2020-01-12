import _ from 'lodash'
import { logger } from '@salto/logging'
import { Element, Field, isObjectType, ObjectType, InstanceElement, isInstanceElement,
  isField, Type, BuiltinTypes } from 'adapter-api'
import { API_NAME, LABEL, CUSTOM_OBJECT,
  METADATA_TYPE, NAMESPACE_SEPARATOR, API_NAME_SEPERATOR } from '../constants'
import { JSONBool } from '../client/types'
import { isCustomObject, metadataType, sfCase, apiName } from '../transformers/transformer'

const log = logger(module)

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

export const addLabel = (elem: Type | Field, label?: string): void => {
  const name = isField(elem) ? elem.name : elem.elemID.name
  const { annotations } = elem
  if (!annotations[LABEL]) {
    annotations[LABEL] = label || sfCase(name)
    log.debug(`added LABEL=${annotations[LABEL]} to ${name}`)
  }
}

export const addApiName = (
  elem: Type | Field,
  name: string,
  parentName?: string
): void => {
  if (!elem.annotations[API_NAME]) {
    elem.annotations[API_NAME] = isField(elem) && parentName
      ? [parentName, name].join(API_NAME_SEPERATOR)
      : name
    log.debug(`added API_NAME=${name} to ${isField(elem) ? elem.name : elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationTypes[API_NAME]) {
    elem.annotationTypes[API_NAME] = BuiltinTypes.SERVICE_ID
  }
}

export const addMetadataType = (elem: ObjectType,
  metadataTypeValue = CUSTOM_OBJECT): void => {
  const { annotations, annotationTypes } = elem
  if (!annotationTypes[METADATA_TYPE]) {
    annotationTypes[METADATA_TYPE] = BuiltinTypes.SERVICE_ID
  }
  if (!annotations[METADATA_TYPE]) {
    annotations[METADATA_TYPE] = metadataTypeValue
    log.debug(`added METADATA_TYPE=${sfCase(metadataTypeValue)} to ${id(elem)}`)
  }
}

export const hasNamespace = (customElement: Field | ObjectType): boolean => (
  apiName(customElement) !== undefined
  && apiName(customElement, true).split(NAMESPACE_SEPARATOR).length === 3
)

export const getNamespace = (customElement: Field | ObjectType): string =>
  apiName(customElement, true).split(NAMESPACE_SEPARATOR)[0]

export const extractFullNamesFromValueList = (values: {full_name: string}[]): string[] =>
  values.map(v => v.full_name)
