/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { strings } from '@salto-io/lowerdash'
import { Element, CORE_ANNOTATIONS, createRefToElmWithValue, ElemID, InstanceElement, isInstanceElement, isObjectType, ObjectType, ReadOnlyElementsSource, ReferenceExpression, Value, Field, isReferenceExpression, isAdditionOrModificationChange, ChangeError } from '@salto-io/adapter-api'
import { TransformFunc, naclCase, transformValuesSync } from '@salto-io/adapter-utils'
import { isDataObjectType, isFileCabinetType, isStandardType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE, ID_FIELD, INTERNAL_ID, NAME_FIELD, NETSUITE, SUBTYPES_PATH, TYPES_PATH } from '../constants'
import { TYPE_ID } from '../client/suiteapp_client/constants'
import { LocalFilterCreator } from '../filter'
import { INTERNAL_ID_TO_TYPES } from '../data_elements/types'
import { SUITEQL_TABLE, getSuiteQLTableInternalIdsMap, getSuiteQLNameToInternalIdsMap } from '../data_elements/suiteql_table_elements'

const log = logger(module)

export const UNKNOWN_TYPE_REFERENCES_TYPE_NAME = 'unknownTypeReferences'
export const UNKNOWN_TYPE_REFERENCES_ELEM_ID = new ElemID(NETSUITE, UNKNOWN_TYPE_REFERENCES_TYPE_NAME)

const UNKNOWN_TYPE = 'object'

const REGEX_TYPE = 'type'
const REGEX_NAME = 'name'

const ORIGINAL_TYPE = 'originalType'

const SOAP_REFERENCE_FIELDS = new Set([NAME_FIELD, INTERNAL_ID, TYPE_ID])

type ResolvedAccountSpecificValue = {
  [ID_FIELD]: string
}

const isNestedObject = (path: ElemID | undefined, value: Value): path is ElemID =>
  path !== undefined && !path.isTopLevel() && _.isPlainObject(value)

const isSoapReferenceObject = (value: Value): boolean =>
  Object.keys(value).every(key => SOAP_REFERENCE_FIELDS.has(key))

const getUnknownTypeReferencesPath = (elemId: ElemID): string => {
  const { parent, path } = elemId.createTopLevelParentID()
  return naclCase(
    [parent.typeName, ...path]
      .map(part => (strings.isNumberStr(part) ? '*' : part))
      .join(ElemID.NAMESPACE_SEPARATOR)
  )
}

const resolvedAccountSpecificValueRegex = new RegExp(`^${_.escapeRegExp(ACCOUNT_SPECIFIC_VALUE)} \\((?<${REGEX_TYPE}>\\w+)\\) \\((?<${REGEX_NAME}>.*)\\)$`)

const toResolvedAccountSpecificValue = (
  { type, name }: {
    type: string
    name: string | undefined
  }
): ResolvedAccountSpecificValue => ({
  id: `${ACCOUNT_SPECIFIC_VALUE} (${type}) (${name ?? 'unknown object'})`,
})

const getNameFromUnknownTypeReference = (
  elemId: ElemID,
  unknownTypeReferencesInstance: InstanceElement,
  internalId: string,
  fallbackName: string | undefined
): string | undefined => {
  // unknownTypeReferencesInstance holds internal ids of references that we don't know their type.
  // in this case, we save an internalId-to-name mapping under the path of the reference, so we'll know
  // to look there when we want to resolve the name back to internal id. for example:
  // if in nexus.state field the reference value was { internalId: "1", name: "California" }
  // then the value we'll store will be { nexus_state: { "1": "California" } }
  const path = getUnknownTypeReferencesPath(elemId)
  if (unknownTypeReferencesInstance.value[path] === undefined) {
    unknownTypeReferencesInstance.value[path] = {}
  }
  if (fallbackName === undefined) {
    return unknownTypeReferencesInstance.value[path][internalId]
  }
  if (unknownTypeReferencesInstance.value[path][internalId] === undefined) {
    log.debug('adding internal id %s to %s with name %s', internalId, path, fallbackName)
    unknownTypeReferencesInstance.value[path][internalId] = fallbackName
  }
  if (unknownTypeReferencesInstance.value[path][internalId] !== fallbackName) {
    log.warn(
      'name %s of internal id %s in %s is not the stored name %s',
      fallbackName,
      internalId,
      path,
      unknownTypeReferencesInstance.value[path][internalId]
    )
  }
  return unknownTypeReferencesInstance.value[path][internalId]
}

const getNameFromSuiteQLTableInstance = (
  suiteQLTableInstance: InstanceElement,
  internalId: string,
  fallbackName: string | undefined
): string | undefined => {
  const internalIdsMap = getSuiteQLTableInternalIdsMap(suiteQLTableInstance)
  if (fallbackName !== undefined && internalIdsMap[internalId] === undefined) {
    log.warn(
      'could not find internal id %s of type %s. adding it with name %s',
      internalId,
      suiteQLTableInstance.elemID.name,
      fallbackName
    )
    internalIdsMap[internalId] = { name: fallbackName }
  }
  return internalIdsMap[internalId]?.name
}

const getUnknownTypeReferencesExistingInstance = (
  elementsSource: ReadOnlyElementsSource
): Promise<InstanceElement | undefined> => elementsSource.get(
  UNKNOWN_TYPE_REFERENCES_ELEM_ID.createNestedID('instance', ElemID.CONFIG_NAME)
)

const getUnknownTypeReferencesElements = async (
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean
): Promise<{ type: ObjectType; instance: InstanceElement }> => {
  const type = new ObjectType({
    elemID: UNKNOWN_TYPE_REFERENCES_ELEM_ID,
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
  })
  if (isPartial) {
    const existingInstance = await getUnknownTypeReferencesExistingInstance(elementsSource)
    if (isInstanceElement(existingInstance)) {
      existingInstance.refType = createRefToElmWithValue(type)
      return { type, instance: existingInstance }
    }
  }
  const instance = new InstanceElement(
    ElemID.CONFIG_NAME, type, undefined, undefined, { [CORE_ANNOTATIONS.HIDDEN]: true }
  )
  return { type, instance }
}

export const getUnknownTypeReferencesMap = async (
  elementsSource: ReadOnlyElementsSource
): Promise<Record<string, Record<string, string[]>>> => {
  const existingInstance = await getUnknownTypeReferencesExistingInstance(elementsSource)
  if (!isInstanceElement(existingInstance)) {
    return {}
  }
  return _.mapValues(
    existingInstance.value as Record<string, Record<string, string>>,
    internalIdToName => _(internalIdToName)
      .entries()
      .groupBy(([_internalId, name]) => name)
      .mapValues(row => row.map(([internalId]) => internalId))
      .value()
  )
}

const addReferenceTypes = (elements: Element[]): void => {
  const referenceTypes: Record<string, ObjectType> = {}

  const replaceFieldType = (field: Field): void => {
    const fieldType = field.getTypeSync()
    if (isObjectType(fieldType) && (isStandardType(fieldType) || isFileCabinetType(fieldType))) {
      // if fieldType is a SDF type we replace it to avoid validation errors because
      // SDF types has fields with a "required" annotation which might not be fulfilled
      const referenceTypeName = `${fieldType.elemID.name}Reference`
      if (referenceTypes[referenceTypeName] === undefined) {
        referenceTypes[referenceTypeName] = new ObjectType({
          elemID: new ElemID(NETSUITE, referenceTypeName),
          annotations: {
            [ORIGINAL_TYPE]: new ReferenceExpression(fieldType.elemID),
          },
          path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, referenceTypeName],
        })
      }
      field.refType = createRefToElmWithValue(referenceTypes[referenceTypeName])
    }
  }

  elements
    .filter(isObjectType)
    .filter(isDataObjectType)
    .forEach(dataType => Object.values(dataType.fields).forEach(replaceFieldType))

  elements.push(...Object.values(referenceTypes))
}

const setOriginalFieldType = (field: Field): void => {
  const fieldType = field.getTypeSync()
  const originalTypeRef = fieldType.annotations[ORIGINAL_TYPE]
  if (isReferenceExpression(originalTypeRef)) {
    field.refType = createRefToElmWithValue(originalTypeRef.value)
  }
}

const setAccountSpecificValues = (
  dataInstance: InstanceElement,
  unknownTypeReferencesInstance: InstanceElement,
  suiteQLTablesMap: Record<string, InstanceElement>,
): void => {
  const transformIds: TransformFunc = ({ value, field, path }) => {
    if (!isNestedObject(path, value)) {
      return value
    }
    const { [INTERNAL_ID]: internalId, [NAME_FIELD]: fallbackName } = value
    if (internalId === undefined) {
      return value
    }

    if (!isSoapReferenceObject(value)) {
      // some inner objects that are not references also have internalId (e.g mainAddress),
      // but it's not required for addition/modification of the instance/field, so we can just omit it.
      return _.omit(value, INTERNAL_ID)
    }

    if (fallbackName === undefined) {
      log.warn('value in %s is missing name field: %o', path.getFullName(), value)
    }

    const fieldType = field?.getTypeSync()
    const suiteQLTableInstance = fieldType !== undefined && suiteQLTablesMap[fieldType.elemID.name] !== undefined
      ? suiteQLTablesMap[fieldType.elemID.name]
      : (INTERNAL_ID_TO_TYPES[value[TYPE_ID]] ?? [])
        .map(typeName => suiteQLTablesMap[typeName])
        .find(instance => instance !== undefined)

    if (suiteQLTableInstance === undefined) {
      const name = getNameFromUnknownTypeReference(
        path, unknownTypeReferencesInstance, internalId, fallbackName
      )
      return toResolvedAccountSpecificValue({ type: UNKNOWN_TYPE, name })
    }
    const name = getNameFromSuiteQLTableInstance(suiteQLTableInstance, internalId, fallbackName)
    return toResolvedAccountSpecificValue({ type: suiteQLTableInstance.elemID.name, name })
  }

  dataInstance.value = transformValuesSync({
    values: dataInstance.value,
    type: dataInstance.getTypeSync(),
    transformFunc: transformIds,
    strict: false,
    pathID: dataInstance.elemID,
  })
}

const toMissingInternalIdError = (elemId: ElemID, name: string): ChangeError => {
  const { parent, path } = elemId.createBaseID()
  return {
    elemID: parent,
    severity: 'Error',
    message: 'Could not identify value in data object',
    detailedMessage:
`Could not find object "${name}" for field "${path.join(ElemID.NAMESPACE_SEPARATOR)}".
In order to deploy that field, please edit it in Salto and either replace the "id" value with the actual value in the environment you are deploying to or remove it.
If you choose to remove it, after a successful deploy you can assign the correct value in the NetSuite UI.`,
  }
}

const toMultipleInternalIdsWarning = (
  elemID: ElemID,
  name: string,
  internalId: string
): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Multiple objects with the same name',
  detailedMessage: `There are multiple objects with the name "${name}". Using the first one (internal id: ${internalId}).`,
})

export const getResolvedAccountSpecificValue = (
  path: ElemID | undefined,
  value: Value,
  unknownTypeReferencesMap: Record<string, Record<string, string[]>>,
  suiteQLTablesMap: Record<string, Record<string, string[]>>,
): { value: Value; error?: ChangeError } => {
  if (!isNestedObject(path, value)) {
    return { value }
  }
  if (typeof value[ID_FIELD] !== 'string' || !_.isEmpty(_.omit(value, ID_FIELD))) {
    return { value }
  }

  const regexRes = value[ID_FIELD].match(resolvedAccountSpecificValueRegex)
  if (regexRes?.groups === undefined) {
    // In case that the user sets the "id" value manually
    log.debug('replacing field id with internalId in path %s', path.getFullName())
    return { value: { [INTERNAL_ID]: value[ID_FIELD] } }
  }

  const { [REGEX_TYPE]: type, [REGEX_NAME]: name } = regexRes.groups
  const nameToInternalIds = type === UNKNOWN_TYPE
    ? unknownTypeReferencesMap[getUnknownTypeReferencesPath(path)]
    : suiteQLTablesMap[type]

  if (nameToInternalIds === undefined) {
    log.warn('did not find internal ids map of %s for path %s', type, path.getFullName())
    return { value: undefined, error: toMissingInternalIdError(path, name) }
  }

  const internalIds = nameToInternalIds[name] ?? []
  if (internalIds.length === 0) {
    log.warn('did not find name %s in internal ids map of %s for path %s', name, type, path.getFullName())
    return { value: undefined, error: toMissingInternalIdError(path, name) }
  }

  const resolvedValue = { [INTERNAL_ID]: internalIds[0] }
  if (internalIds.length > 1) {
    log.warn(
      'there are several internal ids for name %s in internal ids map of %s for path %s - using the first: %s',
      name, type, path.getFullName(), resolvedValue[INTERNAL_ID],
    )
    return { value: resolvedValue, error: toMultipleInternalIdsWarning(path, name, resolvedValue[INTERNAL_ID]) }
  }

  return { value: resolvedValue }
}

const resolveAccountSpecificValues = ({
  instance, unknownTypeReferencesMap, suiteQLTablesMap,
}: {
  instance: InstanceElement
  unknownTypeReferencesMap: Record<string, Record<string, string[]>>
  suiteQLTablesMap: Record<string, Record<string, string[]>>
}): void => {
  const resolve: TransformFunc = ({ path, field, value }) => {
    if (field !== undefined) {
      setOriginalFieldType(field)
    }
    const { value: resolvedValue } = getResolvedAccountSpecificValue(
      path, value, unknownTypeReferencesMap, suiteQLTablesMap
    )
    return resolvedValue
  }

  instance.value = transformValuesSync({
    values: instance.value,
    type: instance.getTypeSync(),
    strict: false,
    pathID: instance.elemID,
    transformFunc: resolve,
  })
}

const filterCreator: LocalFilterCreator = ({ config, elementsSource, isPartial }) => ({
  name: 'dataAccountSpecificValues',
  onFetch: async elements => {
    if (!config.fetch.resolveAccountSpecificValues) {
      return
    }
    const instances = elements.filter(isInstanceElement)
    const suiteQLTablesMap = _.keyBy(
      instances.filter(instance => instance.elemID.typeName === SUITEQL_TABLE),
      instance => instance.elemID.name
    )

    const unknownTypeReferencesElements = await getUnknownTypeReferencesElements(elementsSource, isPartial)
    elements.push(...Object.values(unknownTypeReferencesElements))

    instances
      .filter(instance => isDataObjectType(instance.getTypeSync()))
      .forEach(instance => {
        setAccountSpecificValues(
          instance, unknownTypeReferencesElements.instance, suiteQLTablesMap
        )
      })

    addReferenceTypes(elements)
  },
  preDeploy: async changes => {
    if (!config.fetch.resolveAccountSpecificValues) {
      return
    }
    const relevantChangedInstances = changes
      .filter(isAdditionOrModificationChange)
      .flatMap(change => Object.values(change.data))
      .filter(isInstanceElement)
      .filter(instance => isDataObjectType(instance.getTypeSync()))

    if (relevantChangedInstances.length === 0) {
      return
    }
    const unknownTypeReferencesMap = await getUnknownTypeReferencesMap(elementsSource)
    const suiteQLTablesMap = await getSuiteQLNameToInternalIdsMap(elementsSource)
    relevantChangedInstances.forEach(instance => {
      resolveAccountSpecificValues({ instance, unknownTypeReferencesMap, suiteQLTablesMap })
    })
  },
})

export default filterCreator
