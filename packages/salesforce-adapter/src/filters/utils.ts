/*
*                      Copyright 2023 Salto Labs Ltd.
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
  isField,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  isRemovalOrModificationChange,
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
  getParents,
  isHidden,
  isHiddenValue,
  isUpdatable as isCoreUpdatable,
} from '@salto-io/adapter-utils'
import { FileProperties } from 'jsforce-types'
import { chunks, collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import { DescribeSObjectResult } from 'jsforce'
import { Field as SObjField } from 'jsforce-types/describe-result'
import SalesforceClient from '../client/client'
import { OptionalFeatures } from '../types'
import {
  API_NAME,
  API_NAME_SEPARATOR,
  COMPOUND_FIELD_TYPE_NAMES,
  CUSTOM_METADATA_SUFFIX,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_ANNOTATION,
  INTERNAL_ID_FIELD,
  KEY_PREFIX,
  LABEL,
  MAX_QUERY_LENGTH,
  METADATA_TYPE,
  NAME_FIELDS,
  NAMESPACE_SEPARATOR,
  PLURAL_LABEL,
  SALESFORCE,
  SALESFORCE_OBJECT_ID_FIELD,
} from '../constants'
import { JSONBool, SalesforceRecord } from '../client/types'
import {
  apiName,
  defaultApiName,
  getSObjectFieldElement,
  isCustomObject,
  isNameField,
  metadataType,
  MetadataValues,
  Types,
} from '../transformers/transformer'
import { Filter, FilterContext } from '../filter'

const { toArrayAsync, awu } = collections.asynciterable
const { weightedChunks } = chunks

const log = logger(module)

const METADATA_VALUES_SCHEME = Joi.object({
  [INSTANCE_FULL_NAME_FIELD]: Joi.string().required(),
}).unknown(true)

export const isMetadataValues = createSchemeGuard<MetadataValues>(METADATA_VALUES_SCHEME)

export const isCustomMetadataRecordType = async (elem: Element): Promise<boolean> => {
  const elementApiName = await apiName(elem)
  return isObjectType(elem) && (elementApiName?.endsWith(CUSTOM_METADATA_SUFFIX) ?? false)
}

export const isCustomMetadataRecordInstance = async (
  instance: InstanceElement
): Promise<boolean> => {
  const instanceType = await instance.getType()
  return isCustomMetadataRecordType(instanceType)
}

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
    log.trace('setting default value on %s: %s=%s', elem.elemID.getFullName(), key, defaultValue)
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

export const addKeyPrefix = (elem: TypeElement | Field, keyPrefix?: string): void => {
  setAnnotationDefault(elem, KEY_PREFIX, keyPrefix, BuiltinTypes.HIDDEN_STRING)
}

export const addApiName = (elem: TypeElement | Field, name?: string, parentName?: string):
void => {
  if (!elem.annotations[API_NAME]) {
    const newApiName = name ?? defaultApiName(elem)
    const fullApiName = parentName ? [parentName, newApiName].join(API_NAME_SEPARATOR) : newApiName
    elem.annotations[API_NAME] = fullApiName
    log.trace(`added API_NAME=${fullApiName} to ${elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationRefTypes[API_NAME]) {
    elem.annotationRefTypes[API_NAME] = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
  }
}

export const addMetadataType = (elem: ObjectType, metadataTypeValue = CUSTOM_OBJECT): void => {
  setAnnotationDefault(elem, METADATA_TYPE, metadataTypeValue, BuiltinTypes.SERVICE_ID)
}

export const addDefaults = async (element: ChangeDataType): Promise<void> => {
  const addInstanceDefaults = async (inst: InstanceElement): Promise<void> => {
    if (inst.value[INSTANCE_FULL_NAME_FIELD] === undefined
        && !(await isCustomObject(await inst.getType()))) {
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

export const apiNameParts = async (elem: Element): Promise<string[]> =>
  (await apiName(elem)).split(/\.|-/g)

export const parentApiName = async (elem: Element): Promise<string> =>
  (await apiNameParts(elem))[0]

export const addElementParentReference = (instance: InstanceElement,
  { elemID }: Element): void => {
  const instanceDeps = getParents(instance)
  if (instanceDeps.filter(isReferenceExpression).some(ref => ref.elemID.isEqual(elemID))) {
    return
  }
  instanceDeps.push(new ReferenceExpression(elemID))
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

export const hasInternalId = (elem: Element): boolean => (
  getInternalId(elem) !== undefined && getInternalId(elem) !== ''
)

export const hasApiName = (elem: Element): boolean => (
  apiName(elem) !== undefined
)

export const extractFlatCustomObjectFields = async (elem: Element): Promise<Element[]> => (
  await isCustomObject(elem) && isObjectType(elem)
    ? [elem, ...Object.values(elem.fields)]
    : [elem]
)

export const getWhereConditions = (
  conditionSets: Record<string, string>[],
  maxLen: number
): string[] => {
  const keys = _.uniq(conditionSets.flatMap(Object.keys))
  const constConditionPartLen = (
    _.sumBy(keys, key => `${key} IN ()`.length)
    + (' AND '.length * (keys.length - 1))
  )

  const conditionChunks = weightedChunks(
    conditionSets,
    maxLen - constConditionPartLen,
    // Note - this calculates the condition length as if all values are added to the query.
    // the actual query might end up being shorter if some of the values are not unique.
    // this can be optimized in the future if needed
    condition => _.sumBy(Object.values(condition), val => `${val},`.length),
  )
  const r = conditionChunks.map(conditionChunk => {
    const conditionsByKey = _.groupBy(
      conditionChunk.flatMap(Object.entries),
      ([keyName]) => keyName
    )
    return Object.entries(conditionsByKey)
      .map(([keyName, conditionValues]) => (
        `${keyName} IN (${_.uniq(conditionValues.map(val => val[1])).join(',')})`
      ))
      .join(' AND ')
  })
  return r
}

export const conditionQueries = (query: string, conditionSets: Record<string,
  string>[], maxQueryLen = MAX_QUERY_LENGTH): string[] => {
  const selectWhereStr = `${query} WHERE `
  const whereConditions = getWhereConditions(conditionSets, maxQueryLen - selectWhereStr.length)
  return whereConditions.map(whereCondition => `${selectWhereStr}${whereCondition}`)
}


export const getFieldNamesForQuery = async (field: Field): Promise<string[]> => (
  await isNameField(field)
    ? Object.keys((await field.getType() as ObjectType).fields)
    : [await apiName(field, true)]
)

/**
 * Build a set of queries that select records.
 *
 * @param typeName The name of the table to query from
 * @param fields The names of the fields to query
 * @param conditionSets Each entry specifies field values used to match a specific record
 * @param maxQueryLen returned queries will be split such that no single query exceeds this length
 */
export const buildSelectQueries = async (
  typeName: string,
  fields: string[],
  conditionSets?: Record<string, string>[],
  maxQueryLen = MAX_QUERY_LENGTH,
): Promise<string[]> => {
  const fieldsNameQuery = fields.join(',')
  const selectStr = `SELECT ${fieldsNameQuery} FROM ${typeName}`
  if (conditionSets === undefined || conditionSets.length === 0) {
    return [selectStr]
  }
  return conditionQueries(selectStr, conditionSets, maxQueryLen)
}

export const queryClient = async (client: SalesforceClient,
  queries: string[]): Promise<SalesforceRecord[]> => {
  const recordsIterables = await Promise.all(queries.map(async query => client.queryAll(query)))
  const records = (await Promise.all(
    recordsIterables.map(async recordsIterable => (await toArrayAsync(recordsIterable)).flat())
  )).flat()
  return records
}

export const buildElementsSourceForFetch = (
  elements: ReadonlyArray<Element>,
  config: Pick<FilterContext, 'fetchProfile' | 'elementsSource'>
): ReadOnlyElementsSource => (
  buildElementsSourceFromElements(
    elements,
    config.fetchProfile.metadataQuery.isPartialFetch() ? config.elementsSource : undefined,
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
export const isInstanceOfType = (...types: string[]) => (
  async (elem: Element): Promise<boolean> => (
    isInstanceElement(elem) && types.includes(await apiName(await elem.getType()))
  )
)

export const isInstanceOfTypeChange = (...types: string[]) => (
  (change: Change): Promise<boolean> => (
    isInstanceOfType(...types)(getChangeData(change))
  )
)

export const ensureSafeFilterFetch = ({
  fetchFilterFunc, warningMessage, config, filterName,
}:{
  fetchFilterFunc: Required<Filter>['onFetch']
  warningMessage: string
  filterName: keyof OptionalFeatures
  config : FilterContext
}): Required<Filter>['onFetch'] => (
  async elements => {
    if (!config.fetchProfile.isFeatureEnabled(filterName)) {
      log.debug('skipping %s filter due to configuration', filterName)
      return undefined
    }
    try {
      return await fetchFilterFunc(elements)
    } catch (e) {
      log.warn('failed to run filter %s (warning \'%s\') with error %o, stack %o', filterName, warningMessage, e, e.stack)
      return {
        errors: [
          ({
            message: warningMessage,
            severity: 'Warning',
          }),
        ],
      }
    }
  }
)

/**
 * Remove after https://salto-io.atlassian.net/browse/SALTO-3626
 */
export const isUpdatable = (element: Element): boolean => (
  element.annotations[FIELD_ANNOTATIONS.UPDATEABLE] === true && isCoreUpdatable(element)
)

export const isRestrictableField = (field: Field): boolean => (
  !isHiddenValue(field)
  && isUpdatable(field)
  && !isHidden(field)
  && !isHidden(field.parent)
)

export const omitDefaultKeys = (recordValue: SalesforceRecord): SalesforceRecord =>
  ({
    ..._.omit(recordValue, ['attributes']),
    [SALESFORCE_OBJECT_ID_FIELD]: recordValue[SALESFORCE_OBJECT_ID_FIELD],
  })

const createFieldFromSObjField = async (
  field: SObjField,
  objectName: string,
  objCompoundFieldNames: Record<string, string>,
  systemFields?: string[],
  parent?: ObjectType,
): Promise<Field> => {
  // temporary hack to maintain the current implementation of the code in transformer.ts
  // in the future we should change the implementation of getSObjectFieldElement to simply
  // create the values we need in the first place instead of having to go through toCustomField
  const parentType = parent ?? new ObjectType({ elemID: new ElemID('salesforce', objectName) })
  return getSObjectFieldElement(
    parentType,
    field,
    { apiName: objectName },
    objCompoundFieldNames,
    systemFields,
  )
}

export const getFieldsFromDescribeResult = async (
  sobject: DescribeSObjectResult,
  systemFields?: string[],
  parent?: ObjectType
): Promise<Field[]> => {
  const getCompoundTypeName = (nestedFields: SObjField[], compoundName: string): string => {
    if (compoundName === COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME) {
      return nestedFields.some(field => field.name === NAME_FIELDS.SALUTATION)
        ? COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
        : COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION
    }
    return compoundName
  }

  // Only fields with "child's" referring to a field as it's compoundField
  // should be regarded as compound.
  const objCompoundFieldNames = _.mapValues(
    _.groupBy(
      sobject.fields.filter(field => field.compoundFieldName !== undefined),
      field => field.compoundFieldName,
    ),
    getCompoundTypeName,
  )

  return Promise.all(
    sobject.fields
      .filter(field => !field.compoundFieldName) // Filter out nested fields of compound fields
      .map(field => createFieldFromSObjField(field, sobject.name, objCompoundFieldNames, systemFields, parent))
  )
}
