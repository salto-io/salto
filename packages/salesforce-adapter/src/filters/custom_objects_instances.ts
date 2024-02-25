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
import { collections, values, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement,
  ObjectType,
  Element,
  Field,
  CORE_ANNOTATIONS,
  SaltoError,
  isInstanceElement,
  isPrimitiveType,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  createInvlidIdFieldConfigChange,
  createManyInstancesExcludeConfigChange,
  createUnresolvedRefIdFieldConfigChange,
} from '../config_change'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import {
  SALESFORCE,
  RECORDS_PATH,
  INSTALLED_PACKAGES_PATH,
  CUSTOM_OBJECT_ID_FIELD,
  FIELD_ANNOTATIONS,
  UNLIMITED_INSTANCES_VALUE,
  DETECTS_PARENTS_INDICATOR,
  API_NAME_SEPARATOR,
  LAST_MODIFIED_DATE,
  DATA_INSTANCES_CHANGED_AT_MAGIC,
} from '../constants'
import { FilterResult, RemoteFilterCreator } from '../filter'
import {
  apiName,
  Types,
  createInstanceServiceIds,
  isNameField,
} from '../transformers/transformer'
import {
  getNamespace,
  isMasterDetailField,
  isReferenceField,
  referenceFieldTargetTypes,
  queryClient,
  buildSelectQueries,
  getFieldNamesForQuery,
  safeApiName,
  apiNameSync,
  isQueryableField,
  isHiddenField,
  isReadOnlyField,
  isCustomObjectSync,
  SoqlQuery,
  buildElementsSourceForFetch,
  getChangedAtSingletonInstance,
} from './utils'
import { ConfigChangeSuggestion, DataManagement } from '../types'

const { mapValuesAsync, pickAsync } = promises.object
const { isDefined } = values
const { makeArray } = collections.array
const { keyByAsync, awu } = collections.asynciterable

const log = logger(module)

type TypeName = string
type RecordID = string
type RecordById = Record<RecordID, SalesforceRecord>
type RecordsByTypeAndId = Record<TypeName, RecordById>

export type CustomObjectFetchSetting = {
  objectType: ObjectType
  isBase: boolean
  idFields: Field[]
  aliasFields: Field[]
  invalidIdFields: string[]
  invalidAliasFields: string[]
  invalidManagedBySaltoField?: Field
  managedBySaltoField?: string
  omittedFields: string[]
  changedSince?: string
}

const defaultRecordKeysToOmit = ['attributes']
const nameSeparator = '___'
const aliasSeparator = ' '

const getQueryableFields = (object: ObjectType): Field[] =>
  Object.values(object.fields).filter(isQueryableField)

const buildQueryStrings = async (
  typeName: string,
  fields: Field[],
  ids?: string[],
  managedBySaltoField?: string,
  changedSince?: string,
): Promise<string[]> => {
  const fieldNames = await awu(fields).flatMap(getFieldNamesForQuery).toArray()
  const queryConditions: SoqlQuery[][] = [
    ...makeArray(ids).map((id) => [
      { fieldName: 'Id', operator: 'IN' as const, value: `'${id}'` },
    ]),
    ...(managedBySaltoField !== undefined
      ? [
          [
            {
              fieldName: managedBySaltoField,
              operator: '=' as const,
              value: 'TRUE',
            },
          ],
        ]
      : []),
    ...(changedSince
      ? [
          [
            {
              fieldName: LAST_MODIFIED_DATE,
              operator: '>' as const,
              value: changedSince,
            },
          ],
        ]
      : []),
  ]
  return buildSelectQueries(typeName, fieldNames, queryConditions)
}

type GetRecordsParams = {
  client: SalesforceClient
  customObjectFetchSettings: CustomObjectFetchSetting
  ids?: string[]
}

const getRecords = async ({
  client,
  customObjectFetchSettings: {
    objectType,
    managedBySaltoField,
    omittedFields,
    changedSince,
  },
  ids,
}: GetRecordsParams): Promise<RecordById> => {
  const typeName = apiNameSync(objectType)
  if (!typeName) {
    log.warn('Object %s has no API name', objectType.elemID.getFullName())
    return {}
  }

  const queryableFields = getQueryableFields(objectType).filter(
    (field) => !omittedFields.includes(apiNameSync(field) ?? ''),
  )
  // queryableFields can't be empty - at least the ID fields are queryable and not omitted or we'll consider the config
  // for the object to be invalid and won't get here.

  log.debug(
    'Fetching records for type %s%s%s',
    typeName,
    managedBySaltoField ? `, filtering by ${managedBySaltoField}` : '',
    changedSince ? `, changed since ${changedSince}` : '',
  )
  const queries = await buildQueryStrings(
    typeName,
    queryableFields,
    ids,
    managedBySaltoField,
    changedSince,
  )
  log.debug('Queries: %o', queries)
  const records = await queryClient(client, queries)
  log.debug(`Fetched ${records.length} records of type ${typeName}`)
  return _.keyBy(records, (record) => record[CUSTOM_OBJECT_ID_FIELD])
}

type recordToInstanceParams = {
  type: ObjectType
  record: SalesforceRecord
  instanceSaltoName: string
  instanceAlias?: string
}

const transformCompoundNameValues = async (
  type: ObjectType,
  recordValue: SalesforceRecord,
): Promise<SalesforceRecord> => {
  const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
  // We assume there's only one Name field
  const nameFieldName = Object.keys(
    await pickAsync(type.fields, isNameField),
  )[0]
  const subNameValues = _.pick(recordValue, nameSubFields)
  return _.isUndefined(nameFieldName) || _.isEmpty(subNameValues)
    ? recordValue
    : {
        ..._.omit(recordValue, nameSubFields),
        [nameFieldName]: subNameValues,
        [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
      }
}

const omitDefaultKeys = (recordValue: SalesforceRecord): SalesforceRecord => ({
  ..._.omit(recordValue, defaultRecordKeysToOmit),
  [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
})

export const transformRecordToValues = async (
  type: ObjectType,
  recordValue: SalesforceRecord,
): Promise<SalesforceRecord> => {
  const valuesWithTransformedName = await transformCompoundNameValues(
    type,
    recordValue,
  )
  return omitDefaultKeys(valuesWithTransformedName)
}

const recordToInstance = async ({
  type,
  record,
  instanceSaltoName,
  instanceAlias,
}: recordToInstanceParams): Promise<InstanceElement> => {
  const getInstancePath = async (instanceName: string): Promise<string[]> => {
    const typeNamespace = await getNamespace(type)
    const instanceFileName = pathNaclCase(instanceName)
    if (typeNamespace) {
      return [
        SALESFORCE,
        INSTALLED_PACKAGES_PATH,
        typeNamespace,
        RECORDS_PATH,
        type.elemID.typeName,
        instanceFileName,
      ]
    }
    return [SALESFORCE, RECORDS_PATH, type.elemID.typeName, instanceFileName]
  }
  const { name } = Types.getElemId(
    instanceSaltoName,
    true,
    createInstanceServiceIds(_.pick(record, CUSTOM_OBJECT_ID_FIELD), type),
  )
  return new InstanceElement(
    name,
    type,
    await transformRecordToValues(type, record),
    await getInstancePath(name),
    instanceAlias !== undefined && instanceAlias !== ''
      ? { [CORE_ANNOTATIONS.ALIAS]: instanceAlias }
      : {},
  )
}

const typesRecordsToInstances = async (
  recordByIdAndType: RecordsByTypeAndId,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): Promise<{
  instances: InstanceElement[]
  configChangeSuggestions: ConfigChangeSuggestion[]
}> => {
  const typesToUnresolvedRefFields = {} as Record<TypeName, Set<string>>
  const addUnresolvedRefFieldByType = (
    typeName: string,
    unresolvedFieldName: string,
  ): void => {
    if (typesToUnresolvedRefFields[typeName] === undefined) {
      typesToUnresolvedRefFields[typeName] = new Set([unresolvedFieldName])
    }
    typesToUnresolvedRefFields[typeName].add(unresolvedFieldName)
  }
  const saltoNameByIdAndType = {} as Record<TypeName, Record<RecordID, string>>
  const aliasByIdAndType = {} as Record<TypeName, Record<RecordID, string>>
  const setSaltoName = (
    typeName: TypeName,
    recordId: string,
    saltoName: string,
  ): void => {
    if (saltoNameByIdAndType[typeName] === undefined) {
      saltoNameByIdAndType[typeName] = {}
    }
    saltoNameByIdAndType[typeName][recordId] = saltoName
  }
  const getSaltoName = (
    typeName: TypeName,
    recordId: string,
  ): string | undefined => saltoNameByIdAndType[typeName]?.[recordId]

  const getAlias = (typeName: TypeName, recordId: string): string | undefined =>
    aliasByIdAndType[typeName]?.[recordId]
  const setAlias = (
    typeName: TypeName,
    recordId: string,
    alias: string,
  ): void => {
    if (aliasByIdAndType[typeName] === undefined) {
      aliasByIdAndType[typeName] = {}
    }
    aliasByIdAndType[typeName][recordId] = alias
  }

  const getRecordSaltoName = async (
    typeName: string,
    record: SalesforceRecord,
  ): Promise<string> => {
    const fieldToSaltoName = async (
      field: Field,
    ): Promise<string | undefined> => {
      const fieldValue = record[field.name]
      if (fieldValue === null || fieldValue === undefined) {
        return undefined
      }
      if (!isReferenceField(field)) {
        return fieldValue.toString()
      }
      const referencedTypeNames = referenceFieldTargetTypes(field)
      const referencedName = await awu(referencedTypeNames)
        .map((referencedTypeName) => {
          const rec = recordByIdAndType[referencedTypeName]?.[fieldValue]
          if (rec === undefined) {
            log.debug(
              `Failed to find record with id ${fieldValue} of type ${referencedTypeName} when looking for reference`,
            )
            return undefined
          }
          return getRecordSaltoName(referencedTypeName, rec)
        })
        .find(isDefined)
      if (referencedName === undefined) {
        addUnresolvedRefFieldByType(typeName, field.name)
      }
      return referencedName
    }
    const saltoName = getSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD])
    if (saltoName !== undefined) {
      return saltoName
    }
    const saltoIdFields = customObjectFetchSetting[typeName].idFields
    const saltoIdsValues = await awu(saltoIdFields)
      .map((field) => fieldToSaltoName(field))
      .filter(isDefined)
      .toArray()
    const fullName = saltoIdsValues.join(nameSeparator)
    setSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD], fullName)
    return fullName
  }

  const getRecordAlias = async (
    typeName: string,
    record: SalesforceRecord,
  ): Promise<string> => {
    const fieldToAlias = async (field: Field): Promise<string | undefined> => {
      const fieldValue = record[field.name]
      if (fieldValue === null || fieldValue === undefined) {
        return undefined
      }
      if (!isReferenceField(field)) {
        return fieldValue.toString()
      }
      const referencedTypeNames = referenceFieldTargetTypes(field)
      return awu(referencedTypeNames)
        .map((referencedTypeName) => {
          const rec = recordByIdAndType[referencedTypeName]?.[fieldValue]
          if (rec === undefined) {
            log.debug(
              `Failed to find record with id ${fieldValue} of type ${referencedTypeName} when looking for reference`,
            )
            return undefined
          }
          return getRecordAlias(referencedTypeName, rec)
        })
        .find(isDefined)
    }
    const existingAlias = getAlias(typeName, record[CUSTOM_OBJECT_ID_FIELD])
    if (existingAlias !== undefined) {
      return existingAlias
    }
    const alias = (
      await awu(customObjectFetchSetting[typeName].aliasFields)
        .map((field) => fieldToAlias(field))
        .filter((fieldAlias) => fieldAlias !== undefined && fieldAlias !== '')
        .toArray()
    ).join(aliasSeparator)
    setAlias(typeName, record[CUSTOM_OBJECT_ID_FIELD], alias)
    return alias
  }

  const instances = await awu(Object.entries(recordByIdAndType))
    .flatMap(async ([typeName, idToRecord]) =>
      awu(Object.values(idToRecord))
        .map(async (record) => ({
          type: customObjectFetchSetting[typeName].objectType,
          record,
          instanceSaltoName: await getRecordSaltoName(typeName, record),
          instanceAlias: await getRecordAlias(typeName, record),
        }))
        .filter(
          async (recToInstanceParams) =>
            !Object.keys(typesToUnresolvedRefFields).includes(
              await apiName(recToInstanceParams.type),
            ),
        )
        .map(recordToInstance),
    )
    .toArray()
  const configChangeSuggestions = Object.entries(
    typesToUnresolvedRefFields,
  ).map(([typeName, unresolvedRefFields]) =>
    createUnresolvedRefIdFieldConfigChange(typeName, [...unresolvedRefFields]),
  )
  return {
    instances,
    configChangeSuggestions,
  }
}

const getTargetRecordIds = (
  type: ObjectType,
  records: SalesforceRecord[],
  allowedRefToTypeNames: string[],
): { targetTypeName: string; id: string }[] => {
  const referenceFieldsToTargets = Object.fromEntries(
    Object.values(type.fields)
      .filter(isReferenceField)
      .map((field) => [
        field.name,
        referenceFieldTargetTypes(field).filter((typeName) =>
          allowedRefToTypeNames.includes(typeName),
        ),
      ]),
  )
  return records.flatMap((record) =>
    Object.entries(referenceFieldsToTargets)
      .filter(([fieldName]) => _.isString(record[fieldName]))
      .flatMap(([fieldName, targets]) =>
        targets.map((targetTypeName) => ({
          targetTypeName,
          id: record[fieldName],
        })),
      ),
  )
}

const getReferencedRecords = async (
  client: SalesforceClient,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
  baseRecordByIdAndType: RecordsByTypeAndId,
): Promise<RecordsByTypeAndId> => {
  const allReferenceRecords = {} as RecordsByTypeAndId
  const allowedRefToTypeNames = Object.keys(
    _.pickBy(customObjectFetchSetting, (setting) => !setting.isBase),
  )
  const getMissingReferencedIds = (
    records: RecordsByTypeAndId,
  ): Record<TypeName, RecordID[]> => {
    const missingReferencedRecordIds = Object.entries(records).flatMap(
      ([typeName, idToRecords]) => {
        const type = customObjectFetchSetting[typeName].objectType
        const sfRecords = Object.values(idToRecords)
        const targetRecordIds = getTargetRecordIds(
          type,
          sfRecords,
          allowedRefToTypeNames,
        )
        return (
          targetRecordIds
            // Filter out already fetched target records
            .filter(
              ({ targetTypeName, id }) =>
                allReferenceRecords[targetTypeName]?.[id] === undefined,
            )
        )
      },
    )
    const referencedRecordsById = _.groupBy(
      missingReferencedRecordIds,
      (t) => t.targetTypeName,
    )
    return _.mapValues(referencedRecordsById, (tuples) =>
      _.uniq(tuples.map((t) => t.id)),
    )
  }

  const getReferencedRecordsRecursively = async (
    currentLevelRecords: RecordsByTypeAndId,
  ): Promise<void> => {
    const typeToMissingIds = getMissingReferencedIds(currentLevelRecords)
    const newReferencedRecords = await mapValuesAsync(
      typeToMissingIds,
      (ids, typeName) => {
        const fetchSettings = customObjectFetchSetting[typeName]
        return getRecords({
          client,
          customObjectFetchSettings: fetchSettings,
          ids,
        })
      },
    )
    if (_.isEmpty(newReferencedRecords)) {
      return
    }
    _.merge(allReferenceRecords, newReferencedRecords)
    await getReferencedRecordsRecursively(newReferencedRecords)
  }
  await getReferencedRecordsRecursively(baseRecordByIdAndType)
  return allReferenceRecords
}

export const getAllInstances = async (
  client: SalesforceClient,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): Promise<{
  instances: InstanceElement[]
  configChangeSuggestions: ConfigChangeSuggestion[]
}> => {
  const baseTypesSettings = _.pickBy(
    customObjectFetchSetting,
    (setting) => setting.isBase,
  )
  log.debug('Base types: %o', _.keys(baseTypesSettings))
  const baseRecordByTypeAndId = await mapValuesAsync(
    baseTypesSettings,
    (setting) => getRecords({ client, customObjectFetchSettings: setting }),
  )
  // Get reference to records
  const referencedRecordsByTypeAndId = await getReferencedRecords(
    client,
    customObjectFetchSetting,
    baseRecordByTypeAndId,
  )
  const mergedRecords = {
    ...referencedRecordsByTypeAndId,
    ...baseRecordByTypeAndId,
  }
  return typesRecordsToInstances(mergedRecords, customObjectFetchSetting)
}

const getParentFieldNames = (fields: Field[]): string[] =>
  fields.filter(isMasterDetailField).map((field) => field.name)

export const getIdFields = async (
  type: ObjectType,
  dataManagement: DataManagement,
): Promise<
  Pick<
    CustomObjectFetchSetting,
    'idFields' | 'aliasFields' | 'invalidIdFields' | 'invalidAliasFields'
  >
> => {
  const typeName = await apiName(type)
  const idFieldsNames = dataManagement.getObjectIdsFields(typeName)
  const idFieldsWithParents = idFieldsNames.flatMap((fieldName) =>
    fieldName === DETECTS_PARENTS_INDICATOR
      ? getParentFieldNames(Object.values(type.fields))
      : fieldName,
  )
  const aliasFieldNames = dataManagement.getObjectAliasFields(typeName)
  const aliasFieldsWithParents = aliasFieldNames.flatMap((fieldName) =>
    fieldName === DETECTS_PARENTS_INDICATOR
      ? getParentFieldNames(Object.values(type.fields))
      : fieldName,
  )
  const invalidIdFieldNames = idFieldsWithParents.filter(
    (fieldName) =>
      type.fields[fieldName] === undefined ||
      !isQueryableField(type.fields[fieldName]),
  )
  const [aliasFields, invalidAliasFields] = _.partition(
    aliasFieldsWithParents,
    (fieldName) =>
      type.fields[fieldName] !== undefined &&
      isQueryableField(type.fields[fieldName]),
  )
  if (invalidIdFieldNames.length > 0) {
    return {
      idFields: [],
      aliasFields: [],
      invalidIdFields: invalidIdFieldNames,
      invalidAliasFields,
    }
  }
  return {
    idFields: idFieldsWithParents.map((fieldName) => type.fields[fieldName]),
    aliasFields: aliasFields.map((fieldName) => type.fields[fieldName]),
    invalidIdFields: [],
    invalidAliasFields,
  }
}

export const getCustomObjectsFetchSettings = async (
  types: ObjectType[],
  dataManagement: DataManagement,
  changedAtSingleton?: InstanceElement,
): Promise<CustomObjectFetchSetting[]> => {
  const lastChangedInstanceForType = (typeName: string): string | undefined => {
    if (changedAtSingleton === undefined) {
      return undefined
    }
    const lastChangedAt = _.get(changedAtSingleton.value, [
      DATA_INSTANCES_CHANGED_AT_MAGIC,
      typeName,
    ])
    return _.isString(lastChangedAt)
      ? new Date(lastChangedAt).toISOString()
      : undefined
  }
  const isInvalidManagedBySaltoField = (type: ObjectType): boolean => {
    const isBooleanField = (field: Field): boolean => {
      const fieldType = field.getTypeSync()
      return (
        isPrimitiveType(fieldType) &&
        fieldType.isEqual(Types.primitiveDataTypes.Checkbox)
      )
    }
    const managedBySaltoFieldName =
      dataManagement.managedBySaltoFieldForType(type)
    if (managedBySaltoFieldName === undefined) {
      return false
    }
    return (
      (type.fields[managedBySaltoFieldName].annotations[
        FIELD_ANNOTATIONS.QUERYABLE
      ] ?? true) === false ||
      !isBooleanField(type.fields[managedBySaltoFieldName])
    )
  }
  const typeToFetchSettings = async (
    type: ObjectType,
  ): Promise<CustomObjectFetchSetting> => {
    const managedBySaltoFieldName =
      dataManagement.managedBySaltoFieldForType(type)
    const managedBySaltoField = managedBySaltoFieldName
      ? type.fields[managedBySaltoFieldName]
      : undefined
    const typeApiName = apiNameSync(type)
    if (typeApiName === undefined) {
      log.warn('Type %s has no API name', type.elemID.getFullName())
    }
    return {
      objectType: type,
      isBase: (await dataManagement.shouldFetchObjectType(type)) === 'Always',
      ...(await getIdFields(type, dataManagement)),
      managedBySaltoField: managedBySaltoFieldName,
      invalidManagedBySaltoField: isInvalidManagedBySaltoField(type)
        ? managedBySaltoField
        : undefined,
      omittedFields: typeApiName
        ? dataManagement.omittedFieldsForType(typeApiName)
        : [],
      changedSince: typeApiName
        ? lastChangedInstanceForType(typeApiName)
        : undefined,
    }
  }

  return awu(types)
    .filter(
      async (type) =>
        (await dataManagement.shouldFetchObjectType(type)) !== 'Never',
    )
    .map(typeToFetchSettings)
    .toArray()
}

const filterTypesWithManyInstances = async ({
  validChangesFetchSettings,
  maxInstancesPerType,
  client,
}: {
  validChangesFetchSettings: Record<string, CustomObjectFetchSetting>
  maxInstancesPerType: number
  client: SalesforceClient
}): Promise<{
  filteredChangesFetchSettings: Record<string, CustomObjectFetchSetting>
  heavyTypesSuggestions: ConfigChangeSuggestion[]
}> => {
  if (maxInstancesPerType === UNLIMITED_INSTANCES_VALUE) {
    return {
      filteredChangesFetchSettings: validChangesFetchSettings,
      heavyTypesSuggestions: [],
    }
  }
  const typesToFilter: string[] = []
  const heavyTypesSuggestions: ConfigChangeSuggestion[] = []

  // Creates a lists of typeNames and changeSuggestions for types with too many instances
  await awu(Object.keys(validChangesFetchSettings)).forEach(
    async (typeName) => {
      const instancesCount = await client.countInstances(typeName)
      if (instancesCount > maxInstancesPerType) {
        typesToFilter.push(typeName)
        heavyTypesSuggestions.push(
          createManyInstancesExcludeConfigChange({
            typeName,
            instancesCount,
            maxInstancesPerType,
          }),
        )
      }
    },
  )

  return {
    filteredChangesFetchSettings: _.omit(
      validChangesFetchSettings,
      typesToFilter,
    ),
    heavyTypesSuggestions,
  }
}

const getInaccessibleCustomFields = (objectType: ObjectType): string[] =>
  Object.values(objectType.fields)
    .filter((field) => !isQueryableField(field))
    // these fields are either hidden or will end up being hidden
    .filter((field) => !isHiddenField(field) && !isReadOnlyField(field))
    .map((field) => apiNameSync(field))
    .filter(isDefined)

const createInvalidAliasFieldFetchWarning = async ({
  objectType,
  invalidAliasFields,
}: CustomObjectFetchSetting): Promise<SaltoError> => ({
  message: `Invalid alias fields for type ${await safeApiName(objectType)}: ${safeJsonStringify(invalidAliasFields)}. Value of these fields will be omitted from the Alias`,
  severity: 'Warning',
})

const createInvalidManagedBySaltoFieldFetchWarning = (
  objectType: ObjectType,
  invalidManagedBySaltoField: Field,
): SaltoError => {
  const fieldName = apiNameSync(invalidManagedBySaltoField) as string
  const typeName = apiNameSync(objectType) as string
  const errorPreamble = `The field ${typeName}${API_NAME_SEPARATOR}${fieldName} is configured as the filter field in the saltoManagementFieldSettings.defaultFieldName section of the Salto environment configuration.`
  if (
    (objectType.fields[fieldName].annotations[FIELD_ANNOTATIONS.QUERYABLE] ??
      true) === false
  ) {
    return {
      message: `${errorPreamble} However, the user configured for fetch does not have read access to this field. Records of type ${typeName} will not be fetched.`,
      severity: 'Warning',
    }
  }
  // we assume if the issue is not the queryability of the field then it must be that the field is of the wrong type
  return {
    message: `${errorPreamble} However, the type of the field (${objectType.fields[fieldName].getTypeSync().elemID.getFullName()}) is not boolean. Records of type ${typeName} will not be fetched.`,
    severity: 'Warning',
  }
}

const createInaccessibleFieldsFetchWarning = (
  objectType: ObjectType,
  inaccessibleFields: string[],
): SaltoError => ({
  message: `There are ${inaccessibleFields.length} fields in the ${apiNameSync(objectType)} object that the fetch user does not have access to. These are the fields: ${inaccessibleFields.join(',')}. If ${apiNameSync(objectType)} records are deployed from this environment, values of these fields will appear as deletions.`,
  severity: 'Info',
})

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'customObjectsInstancesFilter',
  remote: true,
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const { dataManagement } = config.fetchProfile
    if (dataManagement === undefined) {
      return {}
    }

    // In the fetch-with-changes-detection case, only data types that changed will be present in the `elements`
    // parameter but there may be instances that changed even though their types remained the same. So we must iterate
    // over all the object types in the elements source.
    const elementsSource = buildElementsSourceForFetch(elements, config)
    const changedAtSingleton =
      await getChangedAtSingletonInstance(elementsSource)

    const customObjects = await awu(await elementsSource.getAll())
      .filter(isCustomObjectSync)
      .toArray()

    // Resolve referenceTo fields from Elements Source for partial fetch
    await awu(customObjects)
      .flatMap((customObject) => Object.values(customObject.fields))
      .filter(isReferenceField)
      .flatMap((field) =>
        makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]),
      )
      .filter(isReferenceExpression)
      .forEach(async (reference) => {
        reference.value = await reference.getResolvedValue(elementsSource)
      })
    const customObjectFetchSetting = await getCustomObjectsFetchSettings(
      customObjects,
      dataManagement,
      changedAtSingleton,
    )
    const [validFetchSettings, invalidFetchSettings] = _.partition(
      customObjectFetchSetting,
      (setting) =>
        setting.invalidIdFields.length === 0 &&
        setting.invalidManagedBySaltoField === undefined,
    )

    if (
      validFetchSettings.length === 0 &&
      invalidFetchSettings.length > 0 &&
      invalidFetchSettings.every(
        (setting) => setting.invalidManagedBySaltoField !== undefined,
      )
    ) {
      return {
        errors: [
          {
            message:
              'The Salto environment is configured to use a Salto Management field but the field is missing or is of the wrong type for all data records. No data records will be fetched. Please verify the field name in saltoManagementFieldSettings.defaultFieldName in the environment configuration file.',
            severity: 'Warning',
          },
        ],
      }
    }

    const validChangesFetchSettings = await keyByAsync(
      validFetchSettings,
      (setting) => apiName(setting.objectType),
    )

    const { filteredChangesFetchSettings, heavyTypesSuggestions } =
      await filterTypesWithManyInstances({
        validChangesFetchSettings,
        maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
        client,
      })

    const { instances, configChangeSuggestions } = await getAllInstances(
      client,
      filteredChangesFetchSettings,
    )
    instances.forEach((instance) => elements.push(instance))
    log.debug(`Fetched ${instances.length} instances of Custom Objects`)
    const invalidFieldSuggestions = await awu(invalidFetchSettings)
      .filter((settings) => settings.invalidIdFields.length > 0)
      .map(async (setting) =>
        createInvlidIdFieldConfigChange(
          await apiName(setting.objectType),
          makeArray(setting.invalidIdFields),
        ),
      )
      .toArray()

    const invalidAliasFieldWarnings = awu(customObjectFetchSetting)
      .filter((setting) => setting.invalidAliasFields.length > 0)
      .map(createInvalidAliasFieldFetchWarning)

    const invalidManagedBySaltoFieldWarnings = invalidFetchSettings
      .filter((setting) => setting.invalidManagedBySaltoField !== undefined)
      .map((settings) => ({
        type: settings.objectType,
        field: settings.invalidManagedBySaltoField as Field,
      }))
      .map(({ type, field }) =>
        createInvalidManagedBySaltoFieldFetchWarning(type, field),
      )

    const typesOfFetchedInstances = new Set(
      elements
        .filter(isInstanceElement)
        .map((instance) => instance.getTypeSync())
        .filter(isCustomObjectSync), // we don't deploy metadata objects, so no reason to warn about them.
    )

    let invalidPermissionsWarnings: SaltoError[] = []

    if (config.fetchProfile.isWarningEnabled('nonQueryableFields') ?? false) {
      invalidPermissionsWarnings = customObjectFetchSetting
        .map((fetchSettings) => fetchSettings.objectType)
        .filter(isCustomObjectSync)
        .map((objectType) => ({
          type: objectType,
          fields: getInaccessibleCustomFields(objectType),
        }))
        .filter(({ fields }) => fields.length > 0)
        .filter(({ type }) => typesOfFetchedInstances.has(type))
        .map(({ type, fields }) =>
          createInaccessibleFieldsFetchWarning(type, fields),
        )
    }

    return {
      configSuggestions: [
        ...invalidFieldSuggestions,
        ...heavyTypesSuggestions,
        ...configChangeSuggestions,
      ],
      errors: await invalidAliasFieldWarnings
        .concat(invalidManagedBySaltoFieldWarnings)
        .concat(invalidPermissionsWarnings)
        .toArray(),
    }
  },
})

export default filterCreator
