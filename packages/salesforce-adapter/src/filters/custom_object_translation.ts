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
import wu from 'wu'
import {
  Element, ElemID, InstanceElement, INSTANCE_ANNOTATIONS, ReferenceExpression,
} from '@salto-io/adapter-api'
import { findInstances } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { generateApiNameToCustomObject, apiNameParts, getInstancesOfMetadataType } from './utils'
import { SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, VALIDATION_RULES_METADATA_TYPE } from '../constants'

const { makeArray } = collections.array

export const CUSTOM_OBJ_METADATA_TYPE_ID = new ElemID(SALESFORCE,
  CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE)

const FIELDS = 'fields'
const NAME = 'name'
const VALIDATION_RULES = 'validationRules'

/**
* This filter change CustomObjectTranslation logical references to fields and validation rules to
* Salto referenes
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const ruleObj = (rule: InstanceElement): string => apiNameParts(rule)[0]
    const ruleShortName = (rule: InstanceElement): string => apiNameParts(rule)[1]

    const apiNameToCustomObject = generateApiNameToCustomObject(elements)
    const apiNameToRules = _.groupBy(
      getInstancesOfMetadataType(elements, VALIDATION_RULES_METADATA_TYPE),
      ruleObj
    )

    wu(findInstances(elements, CUSTOM_OBJ_METADATA_TYPE_ID))
      .forEach(customTranslation => {
        const customObjApiName = apiNameParts(customTranslation)[0]

        // Add parent annotation
        const customObj = apiNameToCustomObject.get(customObjApiName)
        if (customObj) {
          customTranslation.annotate({
            [INSTANCE_ANNOTATIONS.PARENT]: new ReferenceExpression(customObj.elemID),
          })
        }

        // Change fields to reference
        makeArray(customTranslation.value[FIELDS]).forEach(field => {
          const customField = customObj?.fields[field[NAME]]
          if (customField) {
            field[NAME] = new ReferenceExpression(customField.elemID)
          }
        })

        // Change validation rules to refs
        const objRules = apiNameToRules[customObjApiName]
        makeArray(customTranslation.value[VALIDATION_RULES]).forEach(rule => {
          const ruleInstance = objRules?.find(r => _.isEqual(ruleShortName(r), rule[NAME]))
          if (ruleInstance) {
            rule[NAME] = new ReferenceExpression(ruleInstance.elemID)
          }
        })
      })
  },
})

export default filterCreator
