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
  Element, ElemID, ReferenceExpression, Field, ObjectType,
} from '@salto-io/adapter-api'
import { findInstances, findElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { apiName } from '../transformers/transformer'
import { FilterWith } from '../filter'
import { generateApiNameToCustomObject, getInstancesOfMetadataType, customObjectApiName, instanceShortName } from './utils'
import { SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, VALIDATION_RULES_METADATA_TYPE } from '../constants'

const log = logger(module)

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
    const allCustomObjectFields = (elemID: ElemID): Iterable<Field> =>
      wu(findElements(elements, elemID))
        .map(elem => Object.values((elem as ObjectType).fields))
        .flatten()

    const apiNameToCustomObject = generateApiNameToCustomObject(elements)
    const apiNameToRules = _.groupBy(
      getInstancesOfMetadataType(elements, VALIDATION_RULES_METADATA_TYPE),
      customObjectApiName
    )

    wu(findInstances(elements, CUSTOM_OBJ_METADATA_TYPE_ID))
      .forEach(customTranslation => {
        const customObjApiName = customObjectApiName(customTranslation)
        const customObject = apiNameToCustomObject.get(customObjApiName)
        if (_.isUndefined(customObject)) {
          log.warn('failed to find custom object %s for custom translation', customObjApiName,
            apiName(customTranslation))
          return
        }

        // Change fields to reference
        makeArray(customTranslation.value[FIELDS]).forEach(field => {
          const customField = wu(allCustomObjectFields(customObject.elemID))
            .find(f => apiName(f, true) === field[NAME])
          if (customField) {
            field[NAME] = new ReferenceExpression(customField.elemID)
          } else {
            log.warn('failed to find field %s in %s', field[NAME], customObjApiName)
          }
        })

        // Change validation rules to refs
        const objRules = apiNameToRules[customObjApiName]
        makeArray(customTranslation.value[VALIDATION_RULES]).forEach(rule => {
          const ruleInstance = objRules?.find(r => instanceShortName(r) === rule[NAME])
          if (ruleInstance) {
            rule[NAME] = new ReferenceExpression(ruleInstance.elemID)
          } else {
            log.warn('failed to validation rule %s for %s', rule[NAME], customObjApiName)
          }
        })
      })
  },
})

export default filterCreator
