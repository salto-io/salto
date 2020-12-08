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
  TypeElement, BuiltinTypes, ElemID, CoreAnnotationTypes, TypeMap,
  isReferenceExpression, ReferenceExpression, AdditionChange, ChangeDataType, Change, ChangeData,
  isAdditionOrModificationChange, isRemovalOrModificationChange, getChangeElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { FileProperties } from 'jsforce-types'
import {
  API_NAME, LABEL, CUSTOM_OBJECT, METADATA_TYPE, NAMESPACE_SEPARATOR, API_NAME_SEPARATOR,
  INSTANCE_FULL_NAME_FIELD, SALESFORCE, INTERNAL_ID_FIELD, INTERNAL_ID_ANNOTATION,
} from '../constants'
import { JSONBool } from '../client/types'
import { isCustomObject, metadataType, apiName, defaultApiName, Types } from '../transformers/transformer'

const log = logger(module)

export const id = (elem: Element): string => elem.elemID.getFullName()

export const boolValue = (val: JSONBool):
 boolean => val === 'true' || val === true

export const getInstancesOfMetadataType = (elements: Element[], metadataTypeName: string):
 InstanceElement[] =>
  elements.filter(isInstanceElement)
    .filter(element => metadataType(element) === metadataTypeName)

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
    const fullApiName = parentName ? [parentName, newApiName].join(API_NAME_SEPARATOR) : newApiName
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

export const addDefaults = (change: AdditionChange<ChangeDataType>): void => {
  const addInstanceDefaults = (elem: InstanceElement): void => {
    if (elem.value[INSTANCE_FULL_NAME_FIELD] === undefined) {
      elem.value[INSTANCE_FULL_NAME_FIELD] = defaultApiName(elem)
    }
  }

  const addFieldDefaults = (field: Field): void => {
    addApiName(field, undefined, apiName(field.parent))
    addLabel(field)
  }

  const addCustomObjectDefaults = (element: ObjectType): void => {
    addApiName(element)
    addMetadataType(element)
    addLabel(element)
    Object.values(element.fields).forEach(addFieldDefaults)
  }

  const elem = change.data.after
  if (isInstanceElement(elem)) {
    addInstanceDefaults(elem)
  } else if (isObjectType(elem)) {
    addCustomObjectDefaults(elem)
  } else if (isField(elem)) {
    addFieldDefaults(elem)
  }
}

export const getNamespaceFromString = (name: string): string | undefined => {
  const nameParts = name.split(NAMESPACE_SEPARATOR)
  return nameParts.length === 3 ? nameParts[0] : undefined
}

export const getNamespace = (customElement: Field | ObjectType): string | undefined =>
  getNamespaceFromString(apiName(customElement, true))

export const extractFullNamesFromValueList = (values: { [INSTANCE_FULL_NAME_FIELD]: string }[]):
  string[] =>
  values.map(v => v[INSTANCE_FULL_NAME_FIELD])


export const buildAnnotationsObjectType = (annotationTypes: TypeMap): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'AnnotationType')
  return new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(annotationTypes)
      .concat(Object.entries(CoreAnnotationTypes))
      .map(([name, type]) => ({ [name]: { type } }))) })
}

export const generateApiNameToCustomObject = (elements: Element[]): Map<string, ObjectType> =>
  new Map(elements.filter(isCustomObject).map(obj => [apiName(obj), obj]))

export const apiNameParts = (elem: Element): string[] =>
  apiName(elem).split(/\.|-/g)

export const parentApiName = (elem: Element): string =>
  apiNameParts(elem)[0]

export const addObjectParentReference = (instance: InstanceElement,
  { elemID: objectID }: ObjectType): void => {
  const instanceDeps = getParents(instance)
  if (instanceDeps.filter(isReferenceExpression).some(ref => ref.elemId.isEqual(objectID))) {
    return
  }
  instanceDeps.push(new ReferenceExpression(objectID))
  instance.annotations[CORE_ANNOTATIONS.PARENT] = instanceDeps
}

export const fullApiName = (parent: string, child: string): string =>
  ([parent, child].join(API_NAME_SEPARATOR))

export const getFullName = (obj: FileProperties): string => {
  const namePrefix = obj.namespacePrefix
    ? `${obj.namespacePrefix}${NAMESPACE_SEPARATOR}` : ''
  return obj.fullName.startsWith(namePrefix) ? obj.fullName : `${namePrefix}${obj.fullName}`
}

export const getInternalId = (elem: Element): string => (
  (isInstanceElement(elem))
    ? elem.value[INTERNAL_ID_FIELD]
    : elem.annotations[INTERNAL_ID_ANNOTATION]
)

export const setInternalId = (elem: Element, val: string): void => {
  if (isInstanceElement(elem)) {
    elem.value[INTERNAL_ID_FIELD] = val
  } else {
    elem.annotations[INTERNAL_ID_ANNOTATION] = val
    // no need to set the annotation type - already defined
  }
}

// ApiName -> MetadataType -> ElemID
export type ApiNameMapping = Record<string, Record<string, ElemID>>

const mapElemTypeToElemID = (elements: Element[]): Record<string, ElemID> =>
  (Object.fromEntries(elements.map(e => [metadataType(e), e.elemID])))

export const groupByAPIName = (elements: Element[]): ApiNameMapping => (
  _(elements)
    .flatMap(e => (isCustomObject(e) ? [e, ...Object.values(e.fields)] : [e]))
    .groupBy(apiName)
    .mapValues(mapElemTypeToElemID)
    .value()
)

export const getDataFromChanges = <T extends Change<unknown>>(
  dataField: 'before' | 'after', changes: ReadonlyArray<T>,
): ReadonlyArray<ChangeData<T>> => (
    changes
      .filter(
        dataField === 'after' ? isAdditionOrModificationChange : isRemovalOrModificationChange
      )
      .map(change => _.get(change.data, dataField))
  )

// This function checks whether an element is an instance of a certain metadata type
// note that for instances of custom objects this will check the specific type (i.e Lead)
// if you want instances of all custom objects use isInstanceOfCustomObject
export const isInstanceOfType = (type: string) => (
  (elem: Element): elem is InstanceElement => (
    isInstanceElement(elem) && apiName(elem.type) === type
  )
)

export const isInstanceOfTypeChange = (type: string) => (
  (change: Change): change is Change<InstanceElement> => (
    isInstanceOfType(type)(getChangeElement(change))
  )
)

export const isMasterDetailField = (field: Field): boolean => (
  field.type.elemID.isEqual(Types.primitiveDataTypes.MasterDetail.elemID)
)

export const isLookupField = (field: Field): boolean => (
  field.type.elemID.isEqual(Types.primitiveDataTypes.Lookup.elemID)
)
