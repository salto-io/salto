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
import { ElemID, getChangeData, isAdditionOrModificationChange, ChangeError,
  ReadOnlyElementsSource, ChangeDataType, isObjectType, isInstanceElement, Value } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { resolvePath } from '@salto-io/adapter-utils'
import { isCustomFieldName, isCustomRecordType, SCRIPT_TYPES } from '../types'
import { NAME_FIELD, FINANCIAL_LAYOUT, SAVED_SEARCH, SCRIPT_ID, CUSTOM_RECORD_TYPE_NAME_PREFIX, WORKFLOW } from '../constants'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { isDefined } = values

const FIELD_DEFAULT_NAME = 'FIELD_DEFAULT_NAME'

const RestrictedTypeList = [
  'savedSearch',
  'financialLayout',
  'customRecordField',
  'workflow',
  'script',
] as const

type RestrictedType = typeof RestrictedTypeList[number]

type valuesCountPerType = Record<string, Record<string, number>>

type ElementGetter = (elementSource: ReadOnlyElementsSource) => Promise<Record<string, number>>
type ChangeGetter = (change: ChangeDataType) => string[]

type RestrictedTypeGetters = {
  getChangeRestrictedField: ChangeGetter
  getSourceRestrictedFields: ElementGetter
  getMessage: () => string
  getDetailedMessage: (field: string[]) => string
}

const getChangeNestedField = (
  change: ChangeDataType,
  field: string
) : string => resolvePath(change, change.elemID.createNestedID(field))

const getCustomRecordRestrictedData = (element: Value): string[] => {
  if (!isObjectType(element) || !isCustomRecordType(element)) {
    return []
  }

  return Object.keys(element.fields)
    .filter(field => isCustomFieldName(field))
    .map(field => element.fields[field].annotations[SCRIPT_ID])
}

const getWorkflowChangeRestrictedData = (change: ChangeDataType): string[] =>
  (isInstanceElement(change)
    ? _.values(change.value.workflowcustomfields?.workflowcustomfield ?? {}).map(val => val.scriptid) : [])

const getscriptChangeRestrictedData = (change: ChangeDataType): string[] =>
  (isInstanceElement(change)
    ? _.values(change.value.scriptcustomfields?.scriptcustomfield ?? {}).map(val => val.scriptid) : [])

const savedSearchSourceGetter = async (elementsSource: ReadOnlyElementsSource)
  : Promise<Record<string, number>> => {
  const allElements = awu(await elementsSource.getAll()).toArray()
  const allSavedSearch = (await allElements).filter(elem => elem.elemID.typeName === SAVED_SEARCH)
  return _(allSavedSearch)
    .filter(isInstanceElement)
    .flatMap(instance => instance.value.FIELD_DEFAULT_NAME)
    .countBy()
    .value()
}

const financialLayoutSourceGetter = async (elementsSource: ReadOnlyElementsSource)
  : Promise<Record<string, number>> => {
  const allElements = awu(await elementsSource.getAll()).toArray()
  const allFinancialLayout = (await allElements).filter(elem => elem.elemID.typeName === FINANCIAL_LAYOUT)
  return _(allFinancialLayout)
    .filter(isInstanceElement)
    .flatMap(instance => instance.value.name)
    .countBy()
    .value()
}

const customRecordFieldSourceGetter = async (elementsSource: ReadOnlyElementsSource)
  : Promise<Record<string, number>> => {
  const allElements = awu(await elementsSource.getAll()).toArray()
  return _(await allElements)
    .flatMap(getCustomRecordRestrictedData)
    .countBy()
    .value()
}

const workflowSourceGetter = async (elementsSource: ReadOnlyElementsSource)
  : Promise<Record<string, number>> => {
  const allElements = awu(await elementsSource.getAll()).toArray()
  const allWorkflows = (await allElements).filter(elem => elem.elemID.typeName === WORKFLOW)
  return _(allWorkflows)
    .filter(isInstanceElement)
    .flatMap(instance => _.values(instance.value.workflowcustomfields?.workflowcustomfield ?? {}))
    .map(val => val.scriptid)
    .countBy()
    .value()
}

const scriptSourceGetter = async (elementsSource: ReadOnlyElementsSource)
  : Promise<Record<string, number>> => {
  const allElements = awu(await elementsSource.getAll()).toArray()
  const allScripts = (await allElements).filter(elem => SCRIPT_TYPES.includes(elem.elemID.typeName))
  return _(allScripts)
    .filter(isInstanceElement)
    .flatMap(instance => _.values(instance.value.scriptcustomfields?.scriptcustomfield ?? {}))
    .map(val => val.scriptid)
    .countBy()
    .value()
}

const savedSearchGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => [getChangeNestedField(change, FIELD_DEFAULT_NAME)],
  getSourceRestrictedFields: savedSearchSourceGetter,
  getMessage: () => 'A Saved Search with that title already exists',
  getDetailedMessage: title => `Can't deploy this Saved Search because there is already a Saved Search with the title "${title[0]}" in the target account.`
    + ' To deploy it, change its title to a unique one.',
}

const financialLayoutGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => [getChangeNestedField(change, NAME_FIELD)],
  getSourceRestrictedFields: financialLayoutSourceGetter,
  getMessage: () => 'A Financial Layout with that name already exists',
  getDetailedMessage: name => `Can't deploy this Financial Layout because there is already a Financial Layout with the name "${name[0]}" in the target account.`
    + ' To deploy it, change its name to a unique one.',
}

const customRecordGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => [getChangeNestedField(change, SCRIPT_ID)],
  getSourceRestrictedFields: customRecordFieldSourceGetter,
  getMessage: () => 'A Custom Record Type Field with that ID already exists',
  getDetailedMessage: scriptid => `Can't deploy this Custom Record Type Field because there is already a Custom Record Type Field with the ID "${scriptid[0]}" in the target account.`
    + ' To deploy it, change its ID to a unique one.',
}

const workflowGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: getWorkflowChangeRestrictedData,
  getSourceRestrictedFields: workflowSourceGetter,
  getMessage: () => 'This Workflow contains a custom field with an existing ID',
  getDetailedMessage: scriptids => `Can't deploy this Workflow as it contains custom fields with IDs that already exist in the target environment: "${scriptids.toString()}".`
  + ' To deploy it, change their IDs to a unique one.',
}

const scriptGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: getscriptChangeRestrictedData,
  getSourceRestrictedFields: scriptSourceGetter,
  getMessage: () => 'This script contains a parameter with an existing ID',
  getDetailedMessage: scriptids => `Can't deploy this script as it contains parameters ("scriptcustomfields") with IDs that already exist in the target environment: "${scriptids.toString()}".`
  + ' To deploy it, change their IDs to a unique one.',
}

const restrictedTypeGettersMap: Record<RestrictedType, RestrictedTypeGetters> = {
  savedSearch: savedSearchGetters,
  financialLayout: financialLayoutGetters,
  customRecordField: customRecordGetters,
  workflow: workflowGetters,
  script: scriptGetters,
}

const getRestrictedType = (elemID: ElemID, includeFieldElements: boolean): RestrictedType | undefined => {
  if (elemID.idType === 'instance') {
    if (elemID.typeName === SAVED_SEARCH) {
      return 'savedSearch'
    }
    if (elemID.typeName === FINANCIAL_LAYOUT) {
      return 'financialLayout'
    }
    if (elemID.typeName === WORKFLOW) {
      return 'workflow'
    }
    if (SCRIPT_TYPES.includes(elemID.typeName)) {
      return 'script'
    }
  } else if ((includeFieldElements && elemID.idType === 'field') || (!includeFieldElements && elemID.idType === 'type')) {
    if (elemID.typeName.startsWith(CUSTOM_RECORD_TYPE_NAME_PREFIX)) {
      return 'customRecordField'
    }
  }

  return undefined
}

const getEmptyRestrictedTypeRecord = <T>() : Record<RestrictedType, T[]> => ({
  savedSearch: [],
  financialLayout: [],
  customRecordField: [],
  workflow: [],
  script: [],
})

const getTypeToDataRecord = <T> (
  elements: T[],
  getElemID: (element: T) => ElemID,
  includeFieldElements = true,
  typesToInclude?: Set<RestrictedType>,
): Record<RestrictedType, T[]> => {
  const typeToDataRecord = getEmptyRestrictedTypeRecord<T>()

  const addToGroup = (elem: T): void => {
    const elemID = getElemID(elem)
    const restrictedType = getRestrictedType(elemID, includeFieldElements)
    if (isDefined(restrictedType)
      && (_.isUndefined(typesToInclude) || typesToInclude.has(restrictedType))) {
      typeToDataRecord[restrictedType].push(elem)
    }
  }

  elements.forEach(addToGroup)

  return typeToDataRecord
}

const getSourceValuesPerType = async (elementsSource: ReadOnlyElementsSource, relevantTypes: Set<string>)
  : Promise<valuesCountPerType> => Object.fromEntries(
  await Promise.all(
    [...relevantTypes]
      .map(async type => [type, await restrictedTypeGettersMap[type as RestrictedType]
        .getSourceRestrictedFields(elementsSource)] as const)
  )
)

const validateDuplication = async (
  changesData: ChangeDataType[],
  sourceValuesPerType: valuesCountPerType,
  type: RestrictedType
): Promise<Array<ChangeError>> => {
  const getters = restrictedTypeGettersMap[type]

  const getRelevantFields = (fields: string[]): string[] =>
    [...new Set(fields.filter((item: string) => (sourceValuesPerType[type][item] !== 1)))]

  return awu(changesData)
    .map(change => ({
      elemID: change.elemID,
      fields: getRelevantFields(getters.getChangeRestrictedField(change)),
    }))
    .filter(({ fields }) => (fields.length > 0))
    .map(({ elemID, fields }): ChangeError => ({
      elemID,
      severity: 'Error',
      message: getters.getMessage(),
      detailedMessage: getters.getDetailedMessage(fields),
    }))
    .toArray()
}

const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, elementsSource) => {
  const changeElements = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)

  const typesToChanges = getTypeToDataRecord(changeElements, element => element.elemID)
  const relevantTypes = new Set(
    Object.keys(_.pickBy(typesToChanges, mappedChanges => mappedChanges.length > 0)) as RestrictedType[]
  )

  if (!elementsSource || relevantTypes.size === 0) {
    return []
  }

  const sourceValuesPerType = await getSourceValuesPerType(elementsSource, relevantTypes)

  const getErrors = (type: RestrictedType, changesSingleType: ChangeDataType[]): Promise<Array<ChangeError>> =>
    validateDuplication(changesSingleType, sourceValuesPerType, type)

  return awu(Object.entries(typesToChanges))
    .flatMap(([type, changesOfType]) => getErrors(type as RestrictedType, changesOfType))
    .toArray()
}

export default changeValidator
