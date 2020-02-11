/*
*                      Copyright 2020 Salto Labs Ltd.
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
  Element, isObjectType, ElemID, findInstances, findObjectType, Change, ObjectType, transform,
} from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import {
  toMetadataInfo, metadataType, transformPrimitive,
} from '../transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../constants'

const { makeArray } = collections.array

export const LEAD_CONVERT_SETTINGS_TYPE_ID = new ElemID(SALESFORCE, 'LeadConvertSettings')
export const LEAD_TYPE_ID = new ElemID(SALESFORCE, 'Lead')
export const CONVERT_SETTINGS_ANNOTATION = 'convertSettings'
export const OBJECT_MAPPING_FIELD = 'objectMapping'
export const MAPPING_FIELDS_FIELD = 'mappingFields'
export const INPUT_FIELD = 'inputField'
export const OUTPUT_FIELD = 'outputField'
export const OUTPUT_OBJECT = 'outputObject'
export const INSTANCE_FULL_NAME = 'LeadConvertSettings'

/**
* Declare the lead convert settings filter, this filter add LeadConvertSettings annotation
* to Lead.
* Annotation value will be the single lead convert settings instance and instance will be removed
* from the fetched elements list.
*/
const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * Upon fetch, add LeadConvertSettings annotation.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const lead = findObjectType(elements, LEAD_TYPE_ID)
    const convertType = findObjectType(elements, LEAD_CONVERT_SETTINGS_TYPE_ID)
    const convertInstance = [...findInstances(elements, LEAD_CONVERT_SETTINGS_TYPE_ID)].pop()

    if (lead && convertType) {
      delete convertType.fields[INSTANCE_FULL_NAME_FIELD]
      lead.annotationTypes[CONVERT_SETTINGS_ANNOTATION] = convertType

      if (convertInstance) {
        const { value } = convertInstance
        // Remove fullName from the value and type
        delete value[INSTANCE_FULL_NAME_FIELD]

        // Fix list values where needed - convert_list filter is not running on annotations.
        // As annotations are created case by case in the adapter I think it's ok to keep
        // manual fix behavior for now.
        value[OBJECT_MAPPING_FIELD] = _.orderBy(
          makeArray(value[OBJECT_MAPPING_FIELD]),
          OUTPUT_OBJECT
        )
        _.forEach(value[OBJECT_MAPPING_FIELD], mapping => {
          mapping[MAPPING_FIELDS_FIELD] = _.orderBy(
            makeArray(mapping[MAPPING_FIELDS_FIELD]),
            [INPUT_FIELD, OUTPUT_FIELD]
          )
        })

        lead.annotate({ [CONVERT_SETTINGS_ANNOTATION]: transform(
          value,
          convertType,
          transformPrimitive,
          false
        ) || {} })

        const index = elements.findIndex(e => e.elemID.isEqual(convertInstance.elemID))
        elements.splice(index, 1)
      }
    }
  },

  onUpdate: async (before: Element, after: Element,
    _changes: ReadonlyArray<Change>): Promise<SaveResult[]> => {
    if (isObjectType(before) && before.elemID.isEqual(LEAD_TYPE_ID)) {
      const beforeSettings = before.annotations[CONVERT_SETTINGS_ANNOTATION]
      const afterSettings = after.annotations[CONVERT_SETTINGS_ANNOTATION]

      if (!_.isEqual(beforeSettings, afterSettings)) {
        const settingsType = before.annotationTypes[CONVERT_SETTINGS_ANNOTATION] as ObjectType
        const metadataName = metadataType(settingsType)
        return client.update(metadataName,
          toMetadataInfo(INSTANCE_FULL_NAME, afterSettings))
      }
    }
    return Promise.resolve([])
  },
})

export default filterCreator
