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
import {
  BuiltinTypes,
  Change,
  ChangeData,
  ChangeDataType,
  CORE_ANNOTATIONS,
  CoreAnnotationTypes,
  createRefToElmWithValue,
  Element,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isElement,
  isField,
  isInstanceElement,
  isListType,
  isModificationChange,
  isObjectType,
  isReferenceExpression,
  isRemovalOrModificationChange,
  ListType,
  ModificationChange,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  TypeElement,
  TypeMap,
  Value,
} from '@salto-io/adapter-api'
import {
  buildElementsSourceFromElements,
  createSchemeGuard,
  detailedCompare,
  getParents,
  setAdditionalPropertiesAnnotation,
} from '@salto-io/adapter-utils'
import { FileProperties } from '@salto-io/jsforce-types'
import {
  chunks,
  collections,
  promises,
  types,
  values,
} from '@salto-io/lowerdash'
import Joi from 'joi'
import SalesforceClient, { ErrorFilter } from '../client/client'
import {
  FetchElements,
  INSTANCE_SUFFIXES,
  OptionalFeatures,
  ProfileRelatedMetadataType,
  SalesforceConfig,
} from '../types'
import {
  ACTIVE,
  API_NAME,
  API_NAME_SEPARATOR,
  CHANGED_AT_SINGLETON,
  CUSTOM_FIELD,
  CUSTOM_METADATA_SUFFIX,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  DefaultSoqlQueryLimits,
  DEFAULT_FLS_PROFILES,
  FIELD_ANNOTATIONS,
  FLOW_METADATA_TYPE,
  INSTALLED_PACKAGE_METADATA,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_ANNOTATION,
  INTERNAL_ID_FIELD,
  KEY_PREFIX,
  LABEL,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  METADATA_TYPE,
  NAMESPACE_SEPARATOR,
  PLURAL_LABEL,
  PROFILE_RELATED_METADATA_TYPES,
  SALESFORCE,
  STATUS,
  UNIX_TIME_ZERO_STRING,
  VALUE_SET_FIELDS,
  LAST_MODIFIED_DATE,
  CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES,
  VALUE_SET_DEFINITION_FIELDS,
  DEFAULT_VALUE_FORMULA,
  FORMULA,
  FIELD_DEPENDENCY_FIELDS,
} from '../constants'
import {
  CustomField,
  CustomObject,
  JSONBool,
  SalesforceRecord,
} from '../client/types'
import * as transformer from '../transformers/transformer'
import {
  apiName,
  defaultApiName,
  isCustomObject,
  isMetadataObjectType,
  isNameField,
  MetadataInstanceElement,
  metadataType,
  MetadataValues,
  Types,
} from '../transformers/transformer'
import { Filter, FilterContext } from '../filter'
import { createListMetadataObjectsConfigChange } from '../config_change'

const { toArrayAsync, awu } = collections.asynciterable
const { splitDuplicates } = collections.array
const { makeArray } = collections.array
const { weightedChunks } = chunks
const { isDefined } = values
const { pickAsync } = promises.object
const log = logger(module)

const METADATA_VALUES_SCHEME = Joi.object({
  [INSTANCE_FULL_NAME_FIELD]: Joi.string().required(),
}).unknown(true)

export const isMetadataValues = createSchemeGuard<MetadataValues>(
  METADATA_VALUES_SCHEME,
)

/**
 * @deprecated use {@link isInstanceOfTypeSync} instead.
 */
export const isInstanceOfType =
  (...typeNames: string[]) =>
  async (elem: Element): Promise<boolean> =>
    isInstanceElement(elem) &&
    typeNames.includes(await apiName(await elem.getType()))

/**
 * @deprecated use {@link isInstanceOfTypeChangeSync} instead.
 */
export const isInstanceOfTypeChange =
  (...typeNames: string[]) =>
  (change: Change): Promise<boolean> =>
    isInstanceOfType(...typeNames)(getChangeData(change))

export const safeApiName = async (
  elem: Readonly<Element>,
  relative = false,
): Promise<string | undefined> => apiName(elem, relative)

export const metadataTypeSync = (element: Readonly<Element>): string => {
  if (isInstanceElement(element)) {
    return metadataTypeSync(element.getTypeSync())
  }
  if (isField(element)) {
    // We expect to reach to this place only with field of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE] || 'unknown'
}
export const isCustomObjectSync = (
  element: Readonly<Element>,
): element is ObjectType => {
  const res =
    isObjectType(element) &&
    metadataTypeSync(element) === CUSTOM_OBJECT &&
    // The last part is so we can tell the difference between a custom object
    // and the original "CustomObject" type from salesforce (the latter will not have an API_NAME)
    element.annotations[API_NAME] !== undefined
  return res
}

const fullApiNameSync = (elem: Readonly<Element>): string | undefined => {
  if (isInstanceElement(elem)) {
    return isCustomObjectSync(elem.getTypeSync())
      ? elem.value[CUSTOM_OBJECT_ID_FIELD]
      : elem.value[INSTANCE_FULL_NAME_FIELD]
  }
  return elem.annotations[API_NAME] ?? elem.annotations[METADATA_TYPE]
}

export const apiNameSync = (
  elem: Readonly<Element>,
  relative = false,
): string | undefined => {
  const name = fullApiNameSync(elem)
  return name && relative ? transformer.relativeApiName(name) : name
}

export const isMetadataInstanceElementSync = (
  elem: Element,
): elem is MetadataInstanceElement =>
  isInstanceElement(elem) &&
  isMetadataObjectType(elem.getTypeSync()) &&
  elem.value[INSTANCE_FULL_NAME_FIELD] !== undefined

export const isCustomMetadataRecordType = async (
  elem: Element,
): Promise<boolean> => {
  const elementApiName = await apiName(elem)
  return (
    isObjectType(elem) &&
    (elementApiName?.endsWith(CUSTOM_METADATA_SUFFIX) ?? false)
  )
}

export const isCustomMetadataRecordInstance = async (
  instance: InstanceElement,
): Promise<boolean> => {
  const instanceType = await instance.getType()
  return isCustomMetadataRecordType(instanceType)
}

export const boolValue = (val: JSONBool): boolean =>
  val === 'true' || val === true

export const isMasterDetailField = (field: Field): boolean =>
  field.refType.elemID.isEqual(Types.primitiveDataTypes.MasterDetail.elemID)

export const isLookupField = (field: Field): boolean =>
  field.refType.elemID.isEqual(Types.primitiveDataTypes.Lookup.elemID)

export const isQueryableField = (field: Field): boolean =>
  field.annotations[FIELD_ANNOTATIONS.QUERYABLE] === true

export const isHiddenField = (field: Field): boolean =>
  field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] === true

export const isReadOnlyField = (field: Field): boolean =>
  field.annotations[FIELD_ANNOTATIONS.CREATABLE] === false &&
  field.annotations[FIELD_ANNOTATIONS.UPDATEABLE] === false

export const isHierarchyField = (field: Field): boolean =>
  field.refType.elemID.isEqual(Types.primitiveDataTypes.Hierarchy.elemID)

export const isReferenceField = (field?: Field): field is Field =>
  field !== undefined &&
  (isLookupField(field) ||
    isMasterDetailField(field) ||
    isHierarchyField(field))

export const referenceFieldTargetTypes = (field: Field): string[] => {
  if (isLookupField(field) || isMasterDetailField(field)) {
    const referredTypes = field.annotations?.[FIELD_ANNOTATIONS.REFERENCE_TO]
    if (referredTypes === undefined) {
      return []
    }
    return makeArray(referredTypes)
      .map((ref) => (_.isString(ref) ? ref : apiNameSync(ref.value)))
      .filter(isDefined)
  }
  if (isHierarchyField(field)) {
    // hierarchy fields always reference the type that contains them
    return makeArray(apiNameSync(field.parent))
  }
  log.warn(
    'Unknown reference field type %s for field %s',
    field.refType.elemID.getFullName(),
    field.elemID.getFullName(),
  )
  return []
}

export const getInstancesOfMetadataType = async (
  elements: Element[],
  metadataTypeName: string,
): Promise<InstanceElement[]> =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(
      async (element) => (await metadataType(element)) === metadataTypeName,
    )
    .toArray()

const setAnnotationDefault = (
  elem: Element,
  key: string,
  defaultValue: Value,
  type: TypeElement,
): void => {
  if (elem.annotations[key] === undefined) {
    log.trace(
      'setting default value on %s: %s=%s',
      elem.elemID.getFullName(),
      key,
      defaultValue,
    )
    elem.annotations[key] = defaultValue
  }
  if (elem.annotationRefTypes[key] === undefined) {
    log.trace('adding annotation type %s on %s', key, elem.elemID.getFullName())
    elem.annotationRefTypes[key] = createRefToElmWithValue(type)
  }
}

export const addLabel = (elem: TypeElement | Field, label?: string): void => {
  const { name } = elem.elemID
  setAnnotationDefault(elem, LABEL, label ?? name, BuiltinTypes.STRING)
}

export const addPluralLabel = (elem: ObjectType, pluralLabel: string): void => {
  setAnnotationDefault(elem, PLURAL_LABEL, pluralLabel, BuiltinTypes.STRING)
}

export const addKeyPrefix = (
  elem: TypeElement | Field,
  keyPrefix?: string,
): void => {
  setAnnotationDefault(elem, KEY_PREFIX, keyPrefix, BuiltinTypes.HIDDEN_STRING)
}

export const addApiName = (
  elem: TypeElement | Field,
  name?: string,
  parentName?: string,
): void => {
  if (!elem.annotations[API_NAME]) {
    const newApiName = name ?? defaultApiName(elem)
    const fullApiName = parentName
      ? [parentName, newApiName].join(API_NAME_SEPARATOR)
      : newApiName
    elem.annotations[API_NAME] = fullApiName
    log.trace(`added API_NAME=${fullApiName} to ${elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationRefTypes[API_NAME]) {
    elem.annotationRefTypes[API_NAME] = createRefToElmWithValue(
      BuiltinTypes.SERVICE_ID,
    )
  }
}

export const addMetadataType = (
  elem: ObjectType,
  metadataTypeValue = CUSTOM_OBJECT,
): void => {
  setAnnotationDefault(
    elem,
    METADATA_TYPE,
    metadataTypeValue,
    BuiltinTypes.SERVICE_ID,
  )
}

export const addDefaults = async (element: ChangeDataType): Promise<void> => {
  const addInstanceDefaults = async (inst: InstanceElement): Promise<void> => {
    if (
      inst.value[INSTANCE_FULL_NAME_FIELD] === undefined &&
      !(await isCustomObject(await inst.getType()))
    ) {
      inst.value[INSTANCE_FULL_NAME_FIELD] = defaultApiName(inst)
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
  }
  if (isInstanceElement(element)) {
    await addInstanceDefaults(element)
  } else if (isObjectType(element)) {
    await addCustomObjectDefaults(element)
  } else if (isField(element)) {
    await addFieldDefaults(element)
  }
}

const ENDS_WITH_CUSTOM_SUFFIX_REGEX = new RegExp(
  `__(${INSTANCE_SUFFIXES.join('|')})$`,
)

export const removeCustomSuffix = (elementApiName: string): string =>
  elementApiName.replace(ENDS_WITH_CUSTOM_SUFFIX_REGEX, '')

const getNamespaceFromString = (
  relativeApiName: string,
): string | undefined => {
  const parts = removeCustomSuffix(relativeApiName).split(NAMESPACE_SEPARATOR)
  return parts.length !== 1 ? parts[0] : undefined
}

const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
export const layoutObjAndName = (layoutApiName: string): [string, string] => {
  const [obj, ...name] = layoutApiName.split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

/**
 * @deprecated use {@link getNamespaceSync} instead.
 */
export const getNamespace = async (
  element: Element,
): Promise<string | undefined> => {
  const elementApiName = await safeApiName(element, true)
  if (elementApiName === undefined) {
    return undefined
  }
  return isInstanceElement(element) &&
    (await isInstanceOfType(LAYOUT_TYPE_ID_METADATA_TYPE)(element))
    ? getNamespaceFromString(layoutObjAndName(elementApiName)[1])
    : getNamespaceFromString(elementApiName)
}

export const extractFullNamesFromValueList = (
  instanceValues: { [INSTANCE_FULL_NAME_FIELD]: string }[],
): string[] => instanceValues.map((v) => v[INSTANCE_FULL_NAME_FIELD])

export const buildAnnotationsObjectType = (
  annotationTypes: TypeMap,
): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'AnnotationType')
  const annotationObjType = new ObjectType({
    elemID: annotationTypesElemID,
    fields: Object.assign(
      {},
      ...Object.entries(annotationTypes)
        .concat(Object.entries(CoreAnnotationTypes))
        .map(([name, type]) => ({
          [name]: { refType: createRefToElmWithValue(type) },
        })),
    ),
  })
  return setAdditionalPropertiesAnnotation(annotationObjType, false)
}

export const namePartsFromApiName = (elementApiName: string): string[] =>
  elementApiName.split(/\.|-/g)

export const apiNameParts = async (elem: Element): Promise<string[]> =>
  namePartsFromApiName(await apiName(elem))

export const parentApiName = async (elem: Element): Promise<string> =>
  (await apiNameParts(elem))[0]

export const addElementParentReference = (
  instance: InstanceElement,
  element: Element,
): void => {
  const { elemID } = element
  const instanceDeps = getParents(instance)
  if (
    instanceDeps
      .filter(isReferenceExpression)
      .some((ref) => ref.elemID.isEqual(elemID))
  ) {
    return
  }
  instanceDeps.push(new ReferenceExpression(elemID, element))
  instance.annotations[CORE_ANNOTATIONS.PARENT] = instanceDeps
}

export const fullApiName = (parent: string, child: string): string =>
  [parent, child].join(API_NAME_SEPARATOR)

export const getFullName = (
  obj: FileProperties,
  addNamespacePrefixToFullName = true,
): string => {
  if (!obj.namespacePrefix) {
    return obj.fullName
  }

  const namePrefix = `${obj.namespacePrefix}${NAMESPACE_SEPARATOR}`

  if (obj.type === LAYOUT_TYPE_ID_METADATA_TYPE) {
    // Ensure layout name starts with the namespace prefix if there is one.
    // needed due to a SF quirk where sometimes layout metadata instances fullNames return as
    // <namespace>__<objectName>-<layoutName> where it should be
    // <namespace>__<objectName>-<namespace>__<layoutName>
    const [objectName, ...layoutName] = obj.fullName.split('-')
    if (layoutName.length !== 0 && !layoutName[0].startsWith(namePrefix)) {
      return `${objectName}-${namePrefix}${layoutName.join('-')}`
    }
    return obj.fullName
  }

  if (!addNamespacePrefixToFullName) {
    return obj.fullName
  }
  // Instances of type InstalledPackage fullNames should never include the namespace prefix
  if (obj.type === INSTALLED_PACKAGE_METADATA) {
    return obj.fullName
  }

  const fullNameParts = obj.fullName.split(API_NAME_SEPARATOR)
  const name = fullNameParts.slice(-1)[0]
  const parentNames = fullNameParts.slice(0, -1)

  if (name.startsWith(namePrefix)) {
    return obj.fullName
  }

  // In some cases, obj.fullName does not contain the namespace prefix even though
  // obj.namespacePrefix is defined. In these cases, we want to add the prefix manually
  return [...parentNames, `${namePrefix}${name}`].join(API_NAME_SEPARATOR)
}

export const getInternalId = (elem: Element): string =>
  isInstanceElement(elem)
    ? elem.value[INTERNAL_ID_FIELD]
    : elem.annotations[INTERNAL_ID_ANNOTATION]

export const setInternalId = (elem: Element, val: string): void => {
  if (isInstanceElement(elem)) {
    elem.value[INTERNAL_ID_FIELD] = val
  } else {
    elem.annotations[INTERNAL_ID_ANNOTATION] = val
    // no need to set the annotation type - already defined
  }
}

export const hasInternalId = (elem: Element): boolean =>
  getInternalId(elem) !== undefined && getInternalId(elem) !== ''

export const instanceInternalId = (instance: InstanceElement): string =>
  isCustomObjectSync(instance.getTypeSync())
    ? instance.value[CUSTOM_OBJECT_ID_FIELD]
    : getInternalId(instance)

export const hasApiName = (elem: Element): boolean =>
  apiName(elem) !== undefined

export const extractFlatCustomObjectFields = async (
  elem: Element,
): Promise<Element[]> =>
  (await isCustomObject(elem)) && isObjectType(elem)
    ? [elem, ...Object.values(elem.fields)]
    : [elem]

export type QueryOperator = '>' | '<' | '=' | 'IN' // 'IN' is for values that can be split across multiple queries
export type SoqlQuery = {
  fieldName: string
  operator: QueryOperator
  value: string
}

const getWhereConditions = (
  exactConditionSets: Record<string, string>[],
  limitingConditionSets: ReadonlyArray<SoqlQuery>,
  maxLen: number,
): string[] => {
  const buildWhereClause = (
    exactConditionClause: string,
    limitingConditionClause: string,
  ): string => {
    const multipleConditionSets =
      exactConditionClause.length > 0 && limitingConditionClause.length > 0
    const separator = multipleConditionSets ? ' AND ' : ''
    return `${exactConditionClause}${separator}${limitingConditionClause}`
  }

  const keys = _.uniq(exactConditionSets.flatMap(Object.keys))
  const constConditionPartLen =
    _.sumBy(keys, (key) => `${key} IN ()`.length) +
    ' AND '.length * (keys.length - 1)

  const complexConditionQuery = limitingConditionSets
    .map(
      ({ fieldName, operator, value }) => `${fieldName} ${operator} ${value}`,
    )
    .join(' AND ')
  const complexConditionsLength =
    complexConditionQuery.length +
    (Object.keys(exactConditionSets).length > 0 &&
    complexConditionQuery.length > 0
      ? ' AND '.length
      : 0)

  if (complexConditionsLength > maxLen) {
    log.error(
      'Conditions other than `IN` need to be included in every query - they can`t be broken down so they can`t be longer than the maximum query length. getWhereConditions params: %o',
      { exactConditionSets, limitingConditionSets, maxLen },
    )
    throw new Error('SOQL query too long')
  }

  const conditionChunks = weightedChunks(
    exactConditionSets,
    maxLen - constConditionPartLen,
    // Note - this calculates the condition length as if all values are added to the query.
    // the actual query might end up being shorter if some of the values are not unique.
    // this can be optimized in the future if needed
    (condition) =>
      _.sumBy(Object.values(condition), (val) => `${val},`.length) +
      complexConditionsLength,
  )
  const r = conditionChunks.map((conditionChunk) => {
    const conditionsByKey = _.groupBy(
      conditionChunk.flatMap(Object.entries),
      ([keyName]) => keyName,
    )
    return Object.entries(conditionsByKey)
      .map(
        ([keyName, conditionValues]) =>
          `${keyName} IN (${_.uniq(conditionValues.map((val) => val[1])).join(',')})`,
      )
      .join(' AND ')
  })
  if (r.length === 0) {
    return [complexConditionQuery]
  }
  return r.map((queryChunk) =>
    buildWhereClause(queryChunk, complexConditionQuery),
  )
}

export const conditionQueries = (
  query: string,
  conditionSets: ReadonlyArray<ReadonlyArray<SoqlQuery>>,
  queryLimits = DefaultSoqlQueryLimits,
): string[] => {
  const toExactConditions = (
    conditionSet: ReadonlyArray<SoqlQuery>,
  ): Record<string, string> =>
    conditionSet
      .filter((condition) => condition.operator === 'IN')
      .reduce(
        (r, condition) => {
          r[condition.fieldName] = condition.value
          return r
        },
        <Record<string, string>>{},
      )
  if (conditionSets.length === 0) {
    return [query]
  }
  const exactConditionSets = conditionSets
    .map(toExactConditions)
    .filter((exactCondition) => Object.keys(exactCondition).length > 0)
  const limitingConditionSets = conditionSets.flatMap((conditions) =>
    conditions.filter((condition) => condition.operator !== 'IN'),
  )
  const selectWhereStr = `${query} WHERE `
  const whereConditions = getWhereConditions(
    exactConditionSets,
    limitingConditionSets,
    Math.min(
      queryLimits.maxWhereClauseLength,
      queryLimits.maxQueryLength - selectWhereStr.length,
    ),
  )
  return whereConditions.map(
    (whereCondition) => `${selectWhereStr}${whereCondition}`,
  )
}

export const getFieldNamesForQuery = async (field: Field): Promise<string[]> =>
  (await isNameField(field))
    ? Object.keys(((await field.getType()) as ObjectType).fields)
    : [await apiName(field, true)]

/**
 * Build a set of queries that select records.
 *
 * @param typeName The name of the table to query from
 * @param fields The names of the fields to query
 * @param conditionSets Each entry specifies a field name, an operator and an operand to limit the returned records.
 * @param queryLimits Length limits on the generated queries
 */
export const buildSelectQueries = (
  typeName: string,
  fields: string[],
  conditionSets: ReadonlyArray<ReadonlyArray<SoqlQuery>> = [],
  queryLimits = DefaultSoqlQueryLimits,
): string[] => {
  const fieldsNameQuery = fields.join(',')
  const selectStr = `SELECT ${fieldsNameQuery} FROM ${typeName}`
  if (selectStr.length > DefaultSoqlQueryLimits.maxQueryLength) {
    throw new Error('Max query length is too short for the SELECT clause')
  }
  return conditionQueries(selectStr, conditionSets, queryLimits)
}

export const queryClient = async (
  client: SalesforceClient,
  queries: string[],
): Promise<SalesforceRecord[]> => {
  const recordsIterables = await Promise.all(
    queries.map(async (query) => client.queryAll(query)),
  )
  const records = (
    await Promise.all(
      recordsIterables.map(async (recordsIterable) =>
        (await toArrayAsync(recordsIterable)).flat(),
      ),
    )
  ).flat()
  return records
}

export const buildDataRecordsSoqlQueries = async (
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

export const buildElementsSourceForFetch = (
  elements: ReadonlyArray<Element>,
  config: Pick<FilterContext, 'fetchProfile' | 'elementsSource'>,
): ReadOnlyElementsSource =>
  buildElementsSourceFromElements(
    elements,
    config.fetchProfile.metadataQuery.isPartialFetch()
      ? [config.elementsSource]
      : [],
  )

export const getDataFromChanges = <T extends Change<unknown>>(
  dataField: 'before' | 'after',
  changes: ReadonlyArray<T>,
): ReadonlyArray<ChangeData<T>> =>
  changes
    .filter(
      dataField === 'after'
        ? isAdditionOrModificationChange
        : isRemovalOrModificationChange,
    )
    .map((change) => _.get(change.data, dataField))

export const ensureSafeFilterFetch =
  ({
    fetchFilterFunc,
    warningMessage,
    config,
    filterName,
  }: {
    fetchFilterFunc: Required<Filter>['onFetch']
    warningMessage: string
    config: FilterContext
    filterName?: keyof OptionalFeatures
  }): Required<Filter>['onFetch'] =>
  async (elements) => {
    if (
      filterName !== undefined &&
      !config.fetchProfile.isFeatureEnabled(filterName)
    ) {
      log.debug('skipping %s filter due to configuration', filterName)
      return undefined
    }
    try {
      return await fetchFilterFunc(elements)
    } catch (e) {
      log.warn(
        "failed to run filter %s (warning '%s') with error %o, stack %o",
        filterName,
        warningMessage,
        e,
        e.stack,
      )
      return {
        errors: [
          {
            message: warningMessage,
            severity: 'Warning',
          },
        ],
      }
    }
  }

/**
  @deprecated use {@link isStandardObjectSync} instead.
 */
export const isStandardObject = async (
  objectType: ObjectType,
): Promise<boolean> =>
  (await isCustomObject(objectType)) &&
  !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test((await safeApiName(objectType)) ?? '')

export const isStandardObjectSync = (element: Element): element is ObjectType =>
  isCustomObjectSync(element) &&
  !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(apiNameSync(element) ?? '')

export const isStandardField = (field: Field): boolean => {
  const fieldApiName = apiNameSync(field)
  return (
    fieldApiName !== undefined &&
    !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(fieldApiName)
  )
}

export const getInstanceAlias = async (
  instance: MetadataInstanceElement,
  useLabelAsAlias: boolean,
): Promise<string> => {
  const label = instance.value[LABEL]
  if (!useLabelAsAlias || label === undefined) {
    return instance.value[INSTANCE_FULL_NAME_FIELD]
  }
  const namespace = await getNamespace(instance)
  return namespace === undefined ? label : `${label} (${namespace})`
}

export const getChangedAtSingletonInstance = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement | undefined> => {
  const element = await elementsSource.get(
    new ElemID(
      SALESFORCE,
      CHANGED_AT_SINGLETON,
      'instance',
      ElemID.CONFIG_NAME,
    ),
  )
  return isInstanceElement(element) ? element : undefined
}

export const isCustomType = (element: Element): element is ObjectType =>
  isObjectType(element) &&
  ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(apiNameSync(element) ?? '')

const pickFromDuplicates = (
  duplicateProperties: ReadonlyArray<FileProperties>,
): FileProperties | undefined =>
  _(duplicateProperties)
    .sortBy((prop) => new Date(prop.lastModifiedDate))
    .last()

const removeDuplicateFileProps = (
  files: FileProperties[],
): FileProperties[] => {
  const { duplicates, uniques } = splitDuplicates(
    files,
    (fileProps) => `${fileProps.namespacePrefix}__${fileProps.fullName}`,
  )
  duplicates.forEach((props) => {
    log.debug(
      'Found duplicate file props with the same name in response to listMetadataObjects: %o',
      props,
    )
  })
  return uniques.concat(duplicates.map(pickFromDuplicates).filter(isDefined))
}
export const listMetadataObjects = async (
  client: SalesforceClient,
  metadataTypeName: string,
  isUnhandledError?: ErrorFilter,
): Promise<FetchElements<FileProperties[]>> => {
  const { result, errors } = await client.listMetadataObjects(
    { type: metadataTypeName },
    isUnhandledError,
  )

  // Salesforce quirk, we sometimes get the same metadata fullName more than once
  const elements = removeDuplicateFileProps(result)

  return {
    elements,
    configChanges: errors
      .map((e) => e.input)
      .map(createListMetadataObjectsConfigChange),
  }
}

export const toListType = (type: TypeElement): ListType =>
  isListType(type) ? type : new ListType(type)

// This function checks whether an element is an instance of a certain metadata type
// note that for instances of custom objects this will check the specific type (i.e Lead)
// if you want instances of all custom objects use isInstanceOfCustomObject
export const isInstanceOfTypeSync =
  (...typeNames: string[]) =>
  (elem: Element): elem is InstanceElement => {
    if (!isInstanceElement(elem)) {
      return false
    }

    const typeApiName = apiNameSync(elem.getTypeSync())
    if (typeApiName !== undefined) {
      return typeNames.includes(typeApiName)
    }

    // If the type isn't resolved yet fall back on checking the type in the element ID
    return typeNames.includes(elem.elemID.typeName)
  }

export const isInstanceOfTypeChangeSync =
  (...typeNames: string[]) =>
  (change: Change): change is Change<InstanceElement> =>
    isInstanceOfTypeSync(...typeNames)(getChangeData(change))

export const isDeactivatedFlowChange = (
  change: Change,
): change is ModificationChange<InstanceElement> =>
  isModificationChange(change) &&
  isInstanceOfTypeChangeSync(FLOW_METADATA_TYPE)(change) &&
  change.data.before.value[STATUS] === 'Active' &&
  change.data.after.value[STATUS] !== 'Active'

export const isDeactivatedFlowChangeOnly = (
  change: Change,
): change is ModificationChange<InstanceElement> => {
  if (!isDeactivatedFlowChange(change)) {
    return false
  }
  const afterClone = change.data.after.clone()
  afterClone.value[STATUS] = ACTIVE
  const diffWithoutStatus = detailedCompare(change.data.before, afterClone)
  return _.isEmpty(diffWithoutStatus)
}

export type ElementWithResolvedParent<T extends Element> = T & {
  annotations: {
    _parent: types.NonEmptyArray<ReferenceExpression & { value: Element }>
  }
}

export const isElementWithResolvedParent = <T extends Element>(
  element: T,
): element is ElementWithResolvedParent<T> =>
  getParents(element).some(
    (parent) => isReferenceExpression(parent) && isElement(parent.value),
  )

type AuthorInformation = Partial<{
  createdBy: string
  createdAt: string
  changedBy: string
  changedAt: string
}>

export const getAuthorInformationFromFileProps = (
  fileProps: FileProperties,
): AuthorInformation => ({
  createdBy: fileProps.createdByName,
  createdAt: fileProps.createdDate,
  changedBy: fileProps.lastModifiedByName,
  changedAt: fileProps.lastModifiedDate,
})

export const getElementAuthorInformation = ({
  annotations,
}: Element): AuthorInformation => ({
  createdBy: annotations[CORE_ANNOTATIONS.CREATED_BY],
  createdAt: annotations[CORE_ANNOTATIONS.CREATED_AT],
  changedBy: annotations[CORE_ANNOTATIONS.CHANGED_BY],
  changedAt: annotations[CORE_ANNOTATIONS.CHANGED_AT],
})

export const getNamespaceSync = (element: Element): string | undefined => {
  const elementApiName = apiNameSync(element, true)
  if (elementApiName === undefined) {
    return undefined
  }
  return isInstanceElement(element) &&
    isInstanceOfTypeSync(LAYOUT_TYPE_ID_METADATA_TYPE)(element)
    ? getNamespaceFromString(layoutObjAndName(elementApiName)[1])
    : getNamespaceFromString(elementApiName)
}
export const isPicklistField = (
  changedElement: ChangeDataType,
): changedElement is Field =>
  isField(changedElement) &&
  [
    Types.primitiveDataTypes.Picklist.elemID.getFullName(),
    Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
  ].includes(changedElement.refType.elemID.getFullName())

export const isValueSetReference = (field: Field): boolean =>
  isReferenceExpression(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])

export const hasValueSetNameAnnotation = (field: Field): boolean =>
  !_.isUndefined(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])

// This function checks whether an element is an instance of any custom object type.
// Note that this does not apply to custom object definitions themselves, e.g, this will be true
// for instances of Lead, but it will not be true for Lead itself when it is still an instance
// (before the custom objects filter turns it into a type).
// To filter for instances like the Lead definition, use isInstanceOfType(CUSTOM_OBJECT) instead
export const isInstanceOfCustomObjectSync = (
  element: Element,
): element is InstanceElement =>
  isInstanceElement(element) && isCustomObjectSync(element.getTypeSync())

export const isInstanceOfCustomObjectChangeSync = (
  change: Change,
): change is Change<InstanceElement> =>
  isInstanceOfCustomObjectSync(getChangeData(change))

export const aliasOrElemID = (element: Element): string =>
  element.annotations[CORE_ANNOTATIONS.ALIAS] ?? element.elemID.getFullName()

export const getMostRecentFileProperties = (
  fileProps: FileProperties[],
): FileProperties | undefined =>
  _.maxBy(
    fileProps.filter(
      ({ lastModifiedDate }) =>
        _.isString(lastModifiedDate) &&
        lastModifiedDate !== '' &&
        lastModifiedDate !== UNIX_TIME_ZERO_STRING,
    ),
    (prop) => new Date(prop.lastModifiedDate).getTime(),
  )

export const getFLSProfiles = (config: SalesforceConfig): string[] =>
  config.client?.deploy?.flsProfiles ?? DEFAULT_FLS_PROFILES

export const isProfileRelatedMetadataType = (
  typeName: string,
): typeName is ProfileRelatedMetadataType =>
  PROFILE_RELATED_METADATA_TYPES.includes(
    typeName as ProfileRelatedMetadataType,
  )

export const toCustomField = async (
  field: Field,
  omitInternalAnnotations = true,
): Promise<CustomField> => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const newField = new CustomField(
    await apiName(field, true),
    transformer.fieldTypeName(field.refType.elemID.name),
    field.annotations[CORE_ANNOTATIONS.REQUIRED],
    field.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE],
    field.annotations[DEFAULT_VALUE_FORMULA],
    makeArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET]),
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD],
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS],
    field.annotations[FIELD_ANNOTATIONS.RESTRICTED],
    field.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED],
    field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME],
    field.annotations[FORMULA],
    field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS],
    field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
    field.annotations[FIELD_ANNOTATIONS.RELATIONSHIP_NAME],
    field.annotations[FIELD_ANNOTATIONS.LENGTH],
    field.annotations[
      FIELD_ANNOTATIONS.METADATA_RELATIONSHIP_CONTROLLING_FIELD
    ],
  )

  // Skip the assignment of the following annotations that are defined as annotationType
  const annotationsHandledInCtor = [
    FIELD_ANNOTATIONS.VALUE_SET,
    FIELD_ANNOTATIONS.RESTRICTED,
    VALUE_SET_DEFINITION_FIELDS.SORTED,
    VALUE_SET_FIELDS.VALUE_SET_NAME,
    DEFAULT_VALUE_FORMULA,
    FIELD_ANNOTATIONS.LENGTH,
    FIELD_ANNOTATIONS.DEFAULT_VALUE,
    CORE_ANNOTATIONS.REQUIRED,
    FIELD_ANNOTATIONS.RELATIONSHIP_NAME,
    FIELD_ANNOTATIONS.REFERENCE_TO,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS,
    FIELD_ANNOTATIONS.FIELD_DEPENDENCY,
  ]

  // Annotations that are used by the adapter but do not exist in the CustomObject
  const internalUseAnnotations = [
    API_NAME,
    FIELD_ANNOTATIONS.CREATABLE,
    FIELD_ANNOTATIONS.UPDATEABLE,
    FIELD_ANNOTATIONS.QUERYABLE,
    INTERNAL_ID_ANNOTATION,
  ]

  const annotationsToSkip = [
    ...annotationsHandledInCtor,
    ...internalUseAnnotations,
    // We cannot deploy labels on standard fields
    ...(transformer.isCustom(apiNameSync(field)) ? [] : [LABEL]),
  ]
  const isAllowed = async (annotationName: string): Promise<boolean> =>
    (omitInternalAnnotations &&
      Object.keys((await field.getType()).annotationRefTypes).includes(
        annotationName,
      ) &&
      !annotationsToSkip.includes(annotationName)) ||
    (!omitInternalAnnotations &&
      !annotationsHandledInCtor.includes(annotationName))
  // Convert the annotations' names to the required API name
  _.assign(
    newField,
    await pickAsync(field.annotations, (_val, annotationName) =>
      isAllowed(annotationName),
    ),
  )
  return newField
}

const getCustomFields = (
  element: ObjectType,
  skipFields: string[],
): Promise<CustomField[]> =>
  awu(Object.values(element.fields))
    .filter((field) => !transformer.isLocalOnly(field))
    .map((field) => toCustomField(field))
    .filter((field) => !skipFields.includes(field.fullName))
    .filter((field) =>
      CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES.includes(field.type),
    )
    .toArray()

export const toCustomProperties = async (
  element: ObjectType,
  includeFields: boolean,
  skipFields: string[] = [],
): Promise<CustomObject> => {
  // Skip the assignment of the following annotations that are defined as annotationType
  const annotationsToSkip = [
    API_NAME, // we use it as fullName
    METADATA_TYPE, // internal annotation
    INTERNAL_ID_ANNOTATION, // internal annotation
    KEY_PREFIX, // non-deployable annotation
  ]

  const isAllowed = (annotationName: string): boolean =>
    Object.keys(element.annotationRefTypes).includes(annotationName) &&
    !annotationsToSkip.includes(annotationName)
  return {
    fullName: await apiName(element),
    label: element.annotations[LABEL],
    ...(includeFields
      ? { fields: await getCustomFields(element, skipFields) }
      : {}),
    ..._.pickBy(element.annotations, (_val, name) => isAllowed(name)),
  }
}
