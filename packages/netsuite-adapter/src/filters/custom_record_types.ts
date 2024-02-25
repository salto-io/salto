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
import {
  getChangeData,
  isAdditionChange,
  isObjectType,
  ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { getCustomField } from './data_types_custom_fields'
import { isCustomRecordType } from '../types'
import { CUSTOM_RECORD_TYPE, INDEX, METADATA_TYPE, SCRIPT_ID, SOAP, SOURCE } from '../constants'
import { CUSTOM_FIELDS, CUSTOM_FIELDS_LIST } from '../custom_records/custom_record_type'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { andQuery, buildNetsuiteQuery, notQuery } from '../config/query'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const toCustomRecordTypeReference = (type: ObjectType): string => `[${SCRIPT_ID}=${type.annotations[SCRIPT_ID]}]`

const addFieldsToType = (
  type: ObjectType,
  nameToType: Record<string, ObjectType>,
  customRecordTypes: Record<string, ObjectType>,
): void => {
  makeArray(type.annotations[CUSTOM_FIELDS]?.[CUSTOM_FIELDS_LIST]).forEach((customField, index) => {
    const field = getCustomField({
      type,
      customField,
      nameToType,
      customRecordTypes,
    })
    field.annotations = { ...customField, [INDEX]: index }
    type.fields[field.name] = field
  })
}

const removeCustomFieldsAnnotation = (type: ObjectType): void => {
  delete type.annotationRefTypes[CUSTOM_FIELDS]
  delete type.annotations[CUSTOM_FIELDS]
}

const removeInstancesAnnotation = (type: ObjectType): void => {
  delete type.annotationRefTypes.instances
  delete type.annotations.instances
}

const getElementsSourceCustomRecordTypes = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
  existingTypeNames: Set<string>,
): Promise<ObjectType[]> =>
  isPartial
    ? Object.values((await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex)
        .map(({ elemID, serviceID }) => ({ ...elemID.createTopLevelParentID(), serviceID }))
        .filter(
          ({ parent, path }) =>
            parent.idType === 'type' &&
            !existingTypeNames.has(parent.getFullName()) &&
            path.length === 1 &&
            path[0] === SCRIPT_ID,
        )
        .map(
          ({ serviceID, parent }) =>
            new ObjectType({
              elemID: parent,
              annotations: {
                [SCRIPT_ID]: serviceID,
                [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
              },
            }),
        )
    : []

const getElementsSourceTypes = async (
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
  existingTypeNames: Set<string>,
): Promise<ObjectType[]> =>
  isPartial
    ? awu(await elementsSource.list())
        .filter(elemID => elemID.idType === 'type' && !existingTypeNames.has(elemID.getFullName()))
        .map(elemID => new ObjectType({ elemID }))
        .toArray()
    : []

const filterCreator: LocalFilterCreator = ({ elementsSourceIndex, elementsSource, isPartial, config }) => ({
  name: 'customRecordTypesType',
  onFetch: async elements => {
    const types = elements.filter(isObjectType)
    const existingTypeNames = new Set(types.map(type => type.elemID.getFullName()))
    const customRecordTypes = types.filter(isCustomRecordType)
    const elementSourceTypes = await getElementsSourceTypes(elementsSource, isPartial, existingTypeNames)
    const elementSourceCustomRecordTypes = await getElementsSourceCustomRecordTypes(
      elementsSourceIndex,
      isPartial,
      existingTypeNames,
    )
    const nameToType = _.keyBy(types.concat(elementSourceTypes), type => type.elemID.name)
    const customRecordTypesMap = _.keyBy(
      customRecordTypes.concat(elementSourceCustomRecordTypes),
      toCustomRecordTypeReference,
    )
    const fetchQuery = andQuery(
      buildNetsuiteQuery(config.fetch.include),
      notQuery(buildNetsuiteQuery(config.fetch.exclude)),
    )

    customRecordTypes.forEach(type => {
      addFieldsToType(type, nameToType, customRecordTypesMap)
      removeCustomFieldsAnnotation(type)
      if (fetchQuery.isCustomRecordTypeMatch(type.elemID.name)) {
        removeInstancesAnnotation(type)
      }
    })
  },
  onDeploy: async changes => {
    changes
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(type => {
        type.annotate({ [SOURCE]: SOAP })
      })
  },
})

export default filterCreator
