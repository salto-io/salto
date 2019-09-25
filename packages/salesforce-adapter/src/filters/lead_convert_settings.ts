import _ from 'lodash'
import {
  Element, isInstanceElement, isObjectType,
} from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import { toMetadataInfo, metadataType, bpCase } from '../transformer'
import { METADATA_OBJECT_NAME_FIELD } from '../constants'
import { transform } from './convert_types'

const { makeArray } = collections.array

export const LEAD_CONVERT_SETTINGS_TYPE = 'lead_convert_settings'
export const LEAD_TYPE = 'lead'
export const CONVERT_SETTINGS_ANNOTATION = 'convert_settings'
export const OBJECT_MAPPING_FIELD = 'object_mapping'
export const MAPPING_FIELDS_FIELD = 'mapping_fields'
export const INSTANCE_FULL_NAME = 'LeadConvertSettings'

const isTypeName = (element: Element, name: string): boolean =>
  (isInstanceElement(element) ? element.type.elemID.name === name : element.elemID.name === name)

/**
* Declare the lead convert settings filter, this filter add lead_convert_setting annotation
* to Lead.
* Annotation value will be the single lead convert settings instance and instance will be removed
* from the discovered elements list.
*/
const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * Upon discover, add lead_convert_setting annotation.
   *
   * @param elements the already discoverd elements
   */
  onDiscover: async (elements: Element[]) => {
    const lead = _(elements).filter(isObjectType).find(e => isTypeName(e, LEAD_TYPE))
    const convertType = _(elements).filter(isObjectType)
      .find(e => isTypeName(e, LEAD_CONVERT_SETTINGS_TYPE))
    const convertInstance = _(elements).filter(isInstanceElement)
      .find(e => isTypeName(e, LEAD_CONVERT_SETTINGS_TYPE))

    if (lead && convertType) {
      lead.annotationTypes[CONVERT_SETTINGS_ANNOTATION] = convertType
      const value = convertInstance ? convertInstance.value : {}
      // Remove fullName from the value and type
      delete value[bpCase(METADATA_OBJECT_NAME_FIELD)]
      delete convertType.fields[bpCase(METADATA_OBJECT_NAME_FIELD)]

      // Fix list values where needed - convert_list filter is not running on annotations.
      // As annotations are created case by case in the adapter I think it's ok to keep
      // manual fix behavior for now.
      value[OBJECT_MAPPING_FIELD] = makeArray(value[OBJECT_MAPPING_FIELD])
      _.forEach(value[OBJECT_MAPPING_FIELD], mapping => {
        mapping[MAPPING_FIELDS_FIELD] = makeArray(mapping[MAPPING_FIELDS_FIELD])
      })

      lead.annotate({ [CONVERT_SETTINGS_ANNOTATION]: transform(value, convertType, false) || {} })

      // Remove the instance if it exists
      if (convertInstance) {
        const index = elements.findIndex(e => e.elemID.name === convertInstance.elemID.name)
        elements.splice(index, 1)
      }
    }
  },

  onUpdate: async (before: Element, after: Element): Promise<SaveResult[]> => {
    if (isTypeName(before, LEAD_TYPE) && isObjectType(before)) {
      const beforeSettings = before.annotations[CONVERT_SETTINGS_ANNOTATION]
      const afterSettings = after.annotations[CONVERT_SETTINGS_ANNOTATION]

      if (!_.isEqual(beforeSettings, afterSettings)) {
        const metadataName = metadataType(before.annotationTypes[CONVERT_SETTINGS_ANNOTATION])
        return client.update(metadataName,
          toMetadataInfo(INSTANCE_FULL_NAME, afterSettings))
      }
    }
    return Promise.resolve([])
  },
})

export default filterCreator
