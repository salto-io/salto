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
import { logger } from '@salto-io/logging'
import {
  Element, Field, isObjectType, ObjectType, InstanceElement, isInstanceElement, isField,
  TypeElement, BuiltinTypes, ElemID, CoreAnnotationTypes, TypeMap, Value,
  isReferenceExpression, ReferenceExpression, ChangeDataType, Change, ChangeData,
  isAdditionOrModificationChange, isRemovalOrModificationChange, getChangeElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { getParents, createRefToElmWithValue } from '@salto-io/adapter-utils'
import { FileProperties } from 'jsforce-types'
import { collections, promises } from '@salto-io/lowerdash'
import {
  API_NAME, LABEL, CUSTOM_OBJECT, METADATA_TYPE, NAMESPACE_SEPARATOR, API_NAME_SEPARATOR,
  INSTANCE_FULL_NAME_FIELD, SALESFORCE, INTERNAL_ID_FIELD, INTERNAL_ID_ANNOTATION, CUSTOM_FIELD,
} from '../constants'
import { JSONBool, CustomObject } from '../client/types'
import { isCustomObject, metadataType, apiName, defaultApiName, Types, isCustomSettingsObject } from '../transformers/transformer'

const { awu } = collections.asynciterable
const { mapValuesAsync } = promises.object
const log = logger(module)

export const id = (elem: Element): string => elem.elemID.getFullName()

export const boolValue = (val: JSONBool):
 boolean => val === 'true' || val === true

export const isMasterDetailField = (field: Field): boolean => (
  field.refType.elemID.isEqual(Types.primitiveDataTypes.MasterDetail.elemID)
)

export const isLookupField = (field: Field): boolean => (
  field.refType.elemID.isEqual(Types.primitiveDataTypes.Lookup.elemID)
)

export const getInstancesOfMetadataType = async (elements: Element[], metadataTypeName: string):
 Promise<InstanceElement[]> => awu(elements).filter(isInstanceElement)
  .filter(async element => await metadataType(element) === metadataTypeName)
  .toArray()

const setAnnotationDefault = (
  elem: Element,
  key: string,
  defaultValue: Value,
  type: TypeElement,
): void => {
  if (elem.annotations[key] === undefined) {
    log.debug('setting default value on %s: %s=%s', elem.elemID.getFullName(), key, defaultValue)
    elem.annotations[key] = defaultValue
  }
  if (elem.annotationRefTypes[key] === undefined) {
    log.debug('adding annotation type %s on %s', key, elem.elemID.getFullName())
    elem.annotationRefTypes[key] = createRefToElmWithValue(type)
  }
}

export const addLabel = (elem: TypeElement | Field, label?: string): void => {
  const { name } = elem.elemID
  setAnnotationDefault(elem, LABEL, label ?? name, BuiltinTypes.STRING)
}

export const addApiName = (elem: TypeElement | Field, name?: string, parentName?: string):
void => {
  if (!elem.annotations[API_NAME]) {
    const newApiName = name ?? defaultApiName(elem)
    const fullApiName = parentName ? [parentName, newApiName].join(API_NAME_SEPARATOR) : newApiName
    elem.annotations[API_NAME] = fullApiName
    log.debug(`added API_NAME=${fullApiName} to ${elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationRefTypes[API_NAME]) {
    elem.annotationRefTypes[API_NAME] = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
  }
}

export const addMetadataType = (elem: ObjectType, metadataTypeValue = CUSTOM_OBJECT): void => {
  setAnnotationDefault(elem, METADATA_TYPE, metadataTypeValue, BuiltinTypes.SERVICE_ID)
}

export const addDefaults = async (element: ChangeDataType): Promise<void> => {
  const addInstanceDefaults = (elem: InstanceElement): void => {
    if (elem.value[INSTANCE_FULL_NAME_FIELD] === undefined) {
      elem.value[INSTANCE_FULL_NAME_FIELD] = defaultApiName(elem)
    }
  }

  const addFieldDefaults = async (field: Field): Promise<void> => {
    addApiName(field, undefined, await apiName(field.parent))
    addLabel(field)
  }

  const addCustomObjectDefaults = async (elem: ObjectType): Promise<void> => {
    addApiName(elem)
    addMetadataType(elem)
    addLabel(elem)
    await awu(Object.values(elem.fields)).forEach(addFieldDefaults)
    if (!isCustomSettingsObject(elem)) {
      const defaults: Partial<CustomObject> = {
        deploymentStatus: 'Deployed',
        pluralLabel: `${elem.annotations.label}s`,
        sharingModel: Object.values(elem.fields).some(isMasterDetailField)
          ? 'ControlledByParent'
          : 'ReadWrite',
        nameField: { type: 'Text', label: 'Name' },
      }
      const nameFieldType = new ObjectType({ elemID: new ElemID(SALESFORCE, CUSTOM_FIELD) })
      Object.entries(defaults).forEach(([name, value]) => {
        setAnnotationDefault(
          elem, name, value, name === 'nameField' ? nameFieldType : BuiltinTypes.STRING
        )
      })
    }
  }

  if (isInstanceElement(element)) {
    addInstanceDefaults(element)
  } else if (isObjectType(element)) {
    await addCustomObjectDefaults(element)
  } else if (isField(element)) {
    await addFieldDefaults(element)
  }
}

export const getNamespaceFromString = (name: string): string | undefined => {
  const nameParts = name.split(NAMESPACE_SEPARATOR)
  return nameParts.length === 3 ? nameParts[0] : undefined
}

export const getNamespace = async (
  customElement: Field | ObjectType
): Promise<string | undefined> =>
  getNamespaceFromString(await apiName(customElement, true))

export const extractFullNamesFromValueList = (values: { [INSTANCE_FULL_NAME_FIELD]: string }[]):
  string[] =>
  values.map(v => v[INSTANCE_FULL_NAME_FIELD])


export const buildAnnotationsObjectType = (annotationTypes: TypeMap): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'AnnotationType')
  return new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(annotationTypes)
      .concat(Object.entries(CoreAnnotationTypes))
      .map(([name, type]) => ({ [name]: { refType: createRefToElmWithValue(type) } }))) })
}

export const generateApiNameToCustomObject = async (
  elements: Element[]
): Promise<Map<string, ObjectType>> =>
  new Map(await awu(elements)
    .filter(isCustomObject)
    .filter(isObjectType)
    .map(async obj => ([await apiName(obj), obj] as [string, ObjectType]))
    .toArray())

export const apiNameParts = async (elem: Element): Promise<string[]> =>
  (await apiName(elem)).split(/\.|-/g)

export const parentApiName = async (elem: Element): Promise<string> =>
  (await apiNameParts(elem))[0]

export const addObjectParentReference = (instance: InstanceElement,
  { elemID: objectID }: ObjectType): void => {
  const instanceDeps = getParents(instance)
  if (instanceDeps.filter(isReferenceExpression).some(ref => ref.elemID.isEqual(objectID))) {
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

const mapElemTypeToElemID = async (elements: Element[]): Promise<Record<string, ElemID>> => (
  Object.fromEntries(
    await awu(elements).map(async e => [await metadataType(e), e.elemID]).toArray()
  )
)

export const groupByAPIName = async (elements: Element[]): Promise<ApiNameMapping> => (
  mapValuesAsync(
    await awu(elements)
      .flatMap(async e => (await isCustomObject(e) && isObjectType(e)
        ? [e, ...Object.values(e.fields)]
        : [e]
      ))
      .groupBy(e => apiName(e)),
    mapElemTypeToElemID
  )
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
  async (elem: Element): Promise<boolean> => (
    isInstanceElement(elem) && await apiName(await elem.getType()) === type
  )
)

export const isInstanceOfTypeChange = (type: string) => (
  (change: Change): Promise<boolean> => (
    isInstanceOfType(type)(getChangeElement(change))
  )
)
