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
  ReadOnlyElementsSource, ChangeDataType, isObjectType } from '@salto-io/adapter-api'
import { values, collections, promises } from '@salto-io/lowerdash'
import _ from 'lodash'
import { resolvePath } from '@salto-io/adapter-utils'
import { isCustomFieldName, isCustomRecordType } from '../types'
import { NAME_FIELD, FINANCIAL_LAYOUT, SAVED_SEARCH, SCRIPT_ID } from '../constants'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { isDefined } = values
const { mapValuesAsync } = promises.object


const FIELD_DEFAULT_NAME = 'FIELD_DEFAULT_NAME'
const CUSTOM_RECORD_TYPE_NAME_PREFIX = 'customrecord'

type RestrictedType = 'savedSearch' | 'financialLayout' | 'customRecordField'

type GetterParams = {
  elemID: ElemID
  elementsSource: ReadOnlyElementsSource
}

type ElementGetter = (params: GetterParams) => Promise<string[]>
type ChangeGetter = (change: ChangeDataType) => string

type RestrictedTypeGetters = {
  getChangeRestrictedField: ChangeGetter
  getSourceRestrictedFields: ElementGetter
  getMessage: () => string
  getDetailedMessage: (field: string) => string
}

const getNestedField = async ({ elemID, elementsSource }: GetterParams, field: string) : Promise<string[]> =>
  [await elementsSource.get(elemID.createNestedID(field))]

const getChangeNestedField = (
  change: ChangeDataType,
  field: string
) : string => resolvePath(change, change.elemID.createNestedID(field))

const getCustomRecordRestrictedData = async ({ elemID, elementsSource }: GetterParams
): Promise<string[]> => {
  const element = await elementsSource.get(elemID)
  if (!isObjectType(element) || !isCustomRecordType(element)) {
    return []
  }

  return Object.keys(element.fields)
    .filter(field => isCustomFieldName(field))
    .map(field => element.fields[field].annotations[SCRIPT_ID])
}


const savedSearchGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => getChangeNestedField(change, FIELD_DEFAULT_NAME),
  getSourceRestrictedFields: params => getNestedField(params, FIELD_DEFAULT_NAME),
  getMessage: () => 'A Saved Search with that title already exists',
  getDetailedMessage: title => `Can't deploy this Saved Search because there is already a Saved Search with the title "${title}" in the target account.`
    + ' To deploy it, change its title to a unique one.',
}

const financialLayoutGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => getChangeNestedField(change, NAME_FIELD),
  getSourceRestrictedFields: params => getNestedField(params, NAME_FIELD),
  getMessage: () => 'A Financial Layout with that name already exists',
  getDetailedMessage: name => `Can't deploy this Financial Layout because there is already a Financial Layout with the name "${name}" in the target account.`
    + ' To deploy it, change its name to a unique one.',
}

const customRecordGetters: RestrictedTypeGetters = {
  getChangeRestrictedField: change => getChangeNestedField(change, SCRIPT_ID),
  getSourceRestrictedFields: getCustomRecordRestrictedData,
  getMessage: () => 'A Custom Record Type Field with that ID already exists',
  getDetailedMessage: scriptID => `Can't deploy this Custom Record Type Field because there is already a Custom Record Type Field with the ID "${scriptID}" in the target account.`
    + ' To deploy it, change its ID to a unique one.',
}

const restrictedTypeGettersMap: Record<RestrictedType, RestrictedTypeGetters> = {
  savedSearch: savedSearchGetters,
  financialLayout: financialLayoutGetters,
  customRecordField: customRecordGetters,
}

const getRestrictedType = (elemID: ElemID, includeFieldElements: boolean): RestrictedType | undefined => {
  if (elemID.idType === 'instance') {
    if (elemID.typeName === SAVED_SEARCH) {
      return 'savedSearch'
    }

    if (elemID.typeName === FINANCIAL_LAYOUT) {
      return 'financialLayout'
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

const getTypeToRestrictedFields = (
  elementsSource: ReadOnlyElementsSource,
  typeToElementsRecord: Record<RestrictedType, ElemID[]>
): Promise<Record<RestrictedType, string[]>> =>
  mapValuesAsync(typeToElementsRecord,
    (elemIDs, type) =>
      awu(elemIDs)
        .flatMap(elemID => restrictedTypeGettersMap[type as RestrictedType]
          .getSourceRestrictedFields({ elemID, elementsSource }))
        .toArray())

const validateDuplication = (
  changesData: ChangeDataType[],
  uniqueFieldToID: Record<string, number>,
  type: RestrictedType
): Promise<Array<ChangeError>> => {
  const getters = restrictedTypeGettersMap[type]

  return awu(changesData)
    .map(change => ({
      elemID: change.elemID,
      field: getters.getChangeRestrictedField(change),
    }))
    .filter(({ field }) => (uniqueFieldToID[field] ?? 0) > 1)
    .map(({ elemID, field }): ChangeError => ({
      elemID,
      severity: 'Error',
      message: getters.getMessage(),
      detailedMessage: getters.getDetailedMessage(field),
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

  const typeToElements = getTypeToDataRecord(
    (await awu(await elementsSource.list()).toArray()), elem => elem, false, relevantTypes
  )
  const typeToRestrictedFields = await getTypeToRestrictedFields(elementsSource, typeToElements)

  const getErrors = (type: RestrictedType, changesSingleType: ChangeDataType[]): Promise<Array<ChangeError>> =>
    validateDuplication(changesSingleType, _.countBy(typeToRestrictedFields[type]), type)

  return awu(Object.entries(typesToChanges))
    .flatMap(([type, changesOfType]) => getErrors(type as RestrictedType, changesOfType))
    .toArray()
}

export default changeValidator
