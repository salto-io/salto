/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { strings } from '@salto-io/lowerdash'
import {
  Element,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  Value,
  Field,
  isReferenceExpression,
  isAdditionOrModificationChange,
  ChangeError,
} from '@salto-io/adapter-api'
import { TransformFunc, naclCase, setPath, transformValuesSync } from '@salto-io/adapter-utils'
import { isDataObjectType, isFileCabinetType, isStandardType } from '../types'
import {
  ACCOUNT_SPECIFIC_VALUE,
  ID_FIELD,
  INTERNAL_ID,
  NAME_FIELD,
  NETSUITE,
  SUBTYPES_PATH,
  TAX_SCHEDULE,
  TYPES_PATH,
} from '../constants'
import { TYPE_ID } from '../client/suiteapp_client/constants'
import { RemoteFilterCreator } from '../filter'
import {
  SUITEQL_TABLE,
  getSuiteQLTableInternalIdsMap,
  updateSuiteQLTableInstances,
  MissingInternalId,
} from '../data_elements/suiteql_table_elements'

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

type AccountSpecificValueToTransform = {
  instance: InstanceElement
  path: ElemID
  internalId: string
  fallbackName: string | undefined
  suiteQLTableInstance: InstanceElement | undefined
}

type ResolvedAccountSpecificValueResult = {
  value: Value
  error?: ChangeError
  missingInternalId?: MissingInternalId
}

const FIELD_NAME_TO_SUITEQL_TABLE: Record<string, string> = {
  [TAX_SCHEDULE]: TAX_SCHEDULE,
}

const isNestedObject = (path: ElemID | undefined, value: Value): path is ElemID =>
  path !== undefined && !path.isTopLevel() && _.isPlainObject(value)

const isSoapReferenceObject = (value: Value): boolean => Object.keys(value).every(key => SOAP_REFERENCE_FIELDS.has(key))

const getUnknownTypeReferencesPath = (elemId: ElemID): string => {
  const { parent, path } = elemId.createTopLevelParentID()
  return naclCase(
    [parent.typeName, ...path].map(part => (strings.isNumberStr(part) ? '*' : part)).join(ElemID.NAMESPACE_SEPARATOR),
  )
}

const resolvedAccountSpecificValueRegex = new RegExp(
  `^${_.escapeRegExp(ACCOUNT_SPECIFIC_VALUE)} \\((?<${REGEX_TYPE}>\\w+)\\) \\((?<${REGEX_NAME}>.*)\\)$`,
)

const toResolvedAccountSpecificValue = ({
  type,
  name,
}: {
  type: string
  name: string | undefined
}): ResolvedAccountSpecificValue => ({
  id: `${ACCOUNT_SPECIFIC_VALUE} (${type}) (${name ?? 'unknown object'})`,
})

const getNameFromUnknownTypeReference = (
  elemId: ElemID,
  unknownTypeReferencesInstance: InstanceElement,
  internalId: string,
  fallbackName: string | undefined,
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
      unknownTypeReferencesInstance.value[path][internalId],
    )
  }
  return unknownTypeReferencesInstance.value[path][internalId]
}

const getNameFromSuiteQLTableInstance = (
  suiteQLTableInstance: InstanceElement,
  internalId: string,
  fallbackName: string | undefined,
): string | undefined => {
  const internalIdsMap = getSuiteQLTableInternalIdsMap(suiteQLTableInstance)
  if (fallbackName !== undefined && internalIdsMap[internalId] === undefined) {
    log.warn(
      'could not find internal id %s of type %s. adding it with name %s',
      internalId,
      suiteQLTableInstance.elemID.name,
      fallbackName,
    )
    internalIdsMap[internalId] = { name: fallbackName }
  }
  return internalIdsMap[internalId]?.name
}

const getUnknownTypeReferencesExistingInstance = (
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement | undefined> =>
  elementsSource.get(UNKNOWN_TYPE_REFERENCES_ELEM_ID.createNestedID('instance', ElemID.CONFIG_NAME))

const getUnknownTypeReferencesElements = async (
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
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
  const instance = new InstanceElement(ElemID.CONFIG_NAME, type, undefined, undefined, {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  })
  return { type, instance }
}

export const getUnknownTypeReferencesMap = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, Record<string, string[]>>> => {
  const existingInstance = await getUnknownTypeReferencesExistingInstance(elementsSource)
  if (!isInstanceElement(existingInstance)) {
    return {}
  }
  return _.mapValues(existingInstance.value as Record<string, Record<string, string>>, internalIdToName =>
    _(internalIdToName)
      .entries()
      .groupBy(([_internalId, name]) => name)
      .mapValues(row => row.map(([internalId]) => internalId))
      .value(),
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

const getSuiteQLTableInstance = (
  path: ElemID,
  field: Field | undefined,
  typeId: string | undefined,
  suiteQLTablesMap: Record<string, InstanceElement>,
  internalIdToTypes: Record<string, string[]>,
): InstanceElement | undefined => {
  if (
    field !== undefined &&
    FIELD_NAME_TO_SUITEQL_TABLE[field.name] !== undefined &&
    suiteQLTablesMap[FIELD_NAME_TO_SUITEQL_TABLE[field.name]] !== undefined
  ) {
    return suiteQLTablesMap[FIELD_NAME_TO_SUITEQL_TABLE[field.name]]
  }
  const fieldType = field?.getTypeSync()
  if (fieldType !== undefined && suiteQLTablesMap[fieldType.elemID.name] !== undefined) {
    return suiteQLTablesMap[fieldType.elemID.name]
  }
  if (typeId === undefined) {
    log.debug('value in %s has no typeId', path.getFullName())
    return undefined
  }
  const potentialTypes = internalIdToTypes[typeId]
  if (potentialTypes === undefined) {
    log.warn('missing internalId to type mapping for typeId %s in %s', typeId, path.getFullName())
    return undefined
  }
  const suiteQLTableInstance = potentialTypes
    .map(typeName => suiteQLTablesMap[typeName])
    .find(instance => instance !== undefined)
  if (suiteQLTableInstance === undefined) {
    log.warn(
      'missing suiteql table instance for types: %s (typeId: %s) in %s',
      potentialTypes,
      typeId,
      path.getFullName(),
    )
    return undefined
  }
  return suiteQLTableInstance
}

const getAccountSpecificValuesToTransform = (
  instance: InstanceElement,
  suiteQLTablesMap: Record<string, InstanceElement>,
  internalIdToTypes: Record<string, string[]>,
): AccountSpecificValueToTransform[] => {
  const result: AccountSpecificValueToTransform[] = []

  const getAccountSpecificValuesFunc: TransformFunc = ({ value, field, path }) => {
    if (!isNestedObject(path, value)) {
      return value
    }
    const { [INTERNAL_ID]: internalId, [NAME_FIELD]: fallbackName, [TYPE_ID]: typeId } = value
    if (internalId === undefined) {
      return value
    }

    if (!isSoapReferenceObject(value)) {
      // some inner objects that are not references also have internalId (e.g mainAddress),
      // but it's not required for addition/modification of the instance/field, so we can just omit it.
      delete value[INTERNAL_ID]
      return value
    }

    if (fallbackName === undefined) {
      log.warn('value in %s is missing name field: %o', path.getFullName(), value)
    }

    result.push({
      instance,
      path,
      internalId,
      fallbackName,
      suiteQLTableInstance: getSuiteQLTableInstance(path, field, typeId, suiteQLTablesMap, internalIdToTypes),
    })

    return value
  }

  transformValuesSync({
    values: instance.value,
    type: instance.getTypeSync(),
    transformFunc: getAccountSpecificValuesFunc,
    strict: false,
    pathID: instance.elemID,
  })

  return result
}

const toMissingInternalIdError = (elemId: ElemID, name: string): ChangeError => {
  const { parent, path } = elemId.createBaseID()
  return {
    elemID: parent,
    severity: 'Error',
    message: 'Could not identify value in data object',
    detailedMessage: `Could not find object "${name}" for field "${path.join(ElemID.NAMESPACE_SEPARATOR)}".
In order to deploy that field, please edit it in Salto and either replace the "id" value with the actual value in the environment you are deploying to or remove it.
If you choose to remove it, after a successful deploy you can assign the correct value in the NetSuite UI. Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite`,
  }
}

const toMultipleInternalIdsWarning = (elemID: ElemID, name: string, internalId: string): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Multiple objects with the same name',
  detailedMessage: `There are multiple objects with the name "${name}". Using the first one (internal id: ${internalId}). Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite`,
})

export const getResolvedAccountSpecificValue = (
  path: ElemID | undefined,
  value: Value,
  unknownTypeReferencesMap: Record<string, Record<string, string[]>>,
  suiteQLNameToInternalIdsMap: Record<string, Record<string, string[]>>,
): ResolvedAccountSpecificValueResult => {
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
  const nameToInternalIds =
    type === UNKNOWN_TYPE
      ? unknownTypeReferencesMap[getUnknownTypeReferencesPath(path)]
      : suiteQLNameToInternalIdsMap[type]

  if (nameToInternalIds === undefined) {
    log.warn('did not find internal ids map of %s for path %s', type, path.getFullName())
    return { value: undefined, error: toMissingInternalIdError(path, name) }
  }

  const internalIds = nameToInternalIds[name] ?? []
  if (internalIds.length === 0) {
    log.warn('did not find name %s in internal ids map of %s for path %s', name, type, path.getFullName())
    return {
      value: undefined,
      error: toMissingInternalIdError(path, name),
      missingInternalId: type !== UNKNOWN_TYPE ? { tableName: type, name } : undefined,
    }
  }

  const resolvedValue = { [INTERNAL_ID]: internalIds[0] }
  if (internalIds.length > 1) {
    log.warn(
      'there are several internal ids for name %s in internal ids map of %s for path %s - using the first: %s',
      name,
      type,
      path.getFullName(),
      resolvedValue[INTERNAL_ID],
    )
    return { value: resolvedValue, error: toMultipleInternalIdsWarning(path, name, resolvedValue[INTERNAL_ID]) }
  }

  return { value: resolvedValue }
}

const resolveAccountSpecificValues = ({
  instance,
  unknownTypeReferencesMap,
  suiteQLNameToInternalIdsMap,
}: {
  instance: InstanceElement
  unknownTypeReferencesMap: Record<string, Record<string, string[]>>
  suiteQLNameToInternalIdsMap: Record<string, Record<string, string[]>>
}): void => {
  const resolve: TransformFunc = ({ path, field, value }) => {
    if (field !== undefined) {
      setOriginalFieldType(field)
    }
    const { value: resolvedValue } = getResolvedAccountSpecificValue(
      path,
      value,
      unknownTypeReferencesMap,
      suiteQLNameToInternalIdsMap,
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

const filterCreator: RemoteFilterCreator = ({
  client,
  config,
  internalIdToTypes,
  elementsSource,
  isPartial,
  suiteQLNameToInternalIdsMap = {},
}) => ({
  name: 'dataAccountSpecificValues',
  remote: true,
  onFetch: async elements => {
    if (config.fetch.resolveAccountSpecificValues === false) {
      return
    }
    const instances = elements.filter(isInstanceElement)
    const suiteQLTablesMap = _.keyBy(
      instances.filter(instance => instance.elemID.typeName === SUITEQL_TABLE),
      instance => instance.elemID.name,
    )

    const unknownTypeReferencesElements = await getUnknownTypeReferencesElements(elementsSource, isPartial)
    elements.push(...Object.values(unknownTypeReferencesElements))

    const accountSpecificValuesToTransform = instances
      .filter(instance => isDataObjectType(instance.getTypeSync()))
      .flatMap(instance => getAccountSpecificValuesToTransform(instance, suiteQLTablesMap, internalIdToTypes))

    const internalIdsToQuery = accountSpecificValuesToTransform.flatMap(({ suiteQLTableInstance, internalId }) =>
      suiteQLTableInstance !== undefined &&
      getSuiteQLTableInternalIdsMap(suiteQLTableInstance)[internalId] === undefined
        ? { tableName: suiteQLTableInstance.elemID.name, item: internalId }
        : [],
    )

    await updateSuiteQLTableInstances({
      client,
      config,
      queryBy: 'internalId',
      itemsToQuery: internalIdsToQuery,
      suiteQLTablesMap,
    })

    accountSpecificValuesToTransform.forEach(({ instance, path, internalId, fallbackName, suiteQLTableInstance }) => {
      if (suiteQLTableInstance === undefined) {
        const name = getNameFromUnknownTypeReference(
          path,
          unknownTypeReferencesElements.instance,
          internalId,
          fallbackName,
        )
        setPath(instance, path, toResolvedAccountSpecificValue({ type: UNKNOWN_TYPE, name }))
      } else {
        const name = getNameFromSuiteQLTableInstance(suiteQLTableInstance, internalId, fallbackName)
        setPath(instance, path, toResolvedAccountSpecificValue({ type: suiteQLTableInstance.elemID.name, name }))
      }
    })

    addReferenceTypes(elements)
  },
  preDeploy: async changes => {
    if (config.fetch.resolveAccountSpecificValues === false) {
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
    relevantChangedInstances.forEach(instance => {
      resolveAccountSpecificValues({ instance, unknownTypeReferencesMap, suiteQLNameToInternalIdsMap })
    })
  },
})

export default filterCreator
