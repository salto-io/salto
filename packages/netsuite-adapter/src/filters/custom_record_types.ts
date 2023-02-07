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
import { getChangeData, isAdditionChange, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { FilterCreator, FilterWith } from '../filter'
import { getCustomField } from './data_types_custom_fields'
import { isCustomRecordType } from '../types'
import { CUSTOM_RECORD_TYPE, INDEX, METADATA_TYPE, SCRIPT_ID, SOAP, SOURCE } from '../constants'
import { CUSTOM_FIELDS, CUSTOM_FIELDS_LIST } from '../custom_records/custom_record_type'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { andQuery, buildNetsuiteQuery, notQuery } from '../query'

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
  isPartial: boolean
): Promise<ObjectType[]> => (
  isPartial ? Object.values((await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex)
    .map(({ elemID, serviceID }) => ({ ...elemID.createTopLevelParentID(), serviceID }))
    .filter(({ parent, path }) => parent.idType === 'type' && path.length === 1 && path[0] === SCRIPT_ID)
    .map(({ serviceID, parent }) => new ObjectType({
      elemID: parent,
      annotations: {
        [SCRIPT_ID]: serviceID,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })) : []
)

const filterCreator: FilterCreator = ({
  elementsSourceIndex,
  isPartial,
  config,
}): FilterWith<'onFetch' | 'onDeploy'> => ({
  name: 'customRecordTypesType',
  onFetch: async elements => {
    const types = elements.filter(isObjectType)
    const customRecordTypeObjects = types.filter(isCustomRecordType)
    const nameToType = _.keyBy(types, type => type.elemID.name)
    const customRecordTypesMap = _.keyBy(
      customRecordTypeObjects.concat(await getElementsSourceCustomRecordTypes(elementsSourceIndex, isPartial)),
      toCustomRecordTypeReference,
    )
    const fetchQuery = config.fetch?.include || config.fetch?.exclude ? [
      config.fetch?.include && buildNetsuiteQuery(config.fetch.include),
      config.fetch?.exclude && notQuery(buildNetsuiteQuery(config.fetch.exclude)),
    ].filter(values.isDefined).reduce(andQuery) : { isCustomRecordTypeMatch: () => false }

    customRecordTypeObjects.forEach(type => {
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
