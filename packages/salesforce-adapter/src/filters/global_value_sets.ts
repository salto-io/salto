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
import {
  Element,
  ObjectType,
  Field,
  ReferenceExpression,
  isObjectType,
  CORE_ANNOTATIONS,
  createRestriction,
  InstanceElement,
  isInstanceElement, Values,
} from '@salto-io/adapter-api'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterWith, LocalFilterCreator } from '../filter'
import {
  FIELD_ANNOTATIONS,
  GLOBAL_VALUE_SET_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  VALUE_SET_FIELDS,
} from '../constants'
import { isCustomObject, apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch } from './utils'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

export const CUSTOM_VALUE = 'customValue'
export const MASTER_LABEL = 'master_label'


type GlobalValueSetValue = InstanceElement['value'] & {
  [FIELD_ANNOTATIONS.CUSTOM_VALUE]: {
    [INSTANCE_FULL_NAME_FIELD]: string
  }[]
}

const isGlobalValueSetValue = (value: Values): value is GlobalValueSetValue => (
  makeArray(value[CUSTOM_VALUE])
    .every(entry => _.isString(_.get(entry, INSTANCE_FULL_NAME_FIELD)))
)

const addRefAndRestrict = (
  object: ObjectType,
  globalValueSetInstanceByName: multiIndex.Index<[string], InstanceElement>
): void => {
  const getValueSetName = (field: Field): string | undefined =>
    field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]

  Object.values(object.fields)
    .forEach(f => {
      const valueSetName = getValueSetName(f)
      if (valueSetName === undefined) {
        return
      }
      const globalValueSetInstance = globalValueSetInstanceByName.get(valueSetName)
      if (globalValueSetInstance === undefined) {
        log.warn('Could not find GlobalValueSet instance with name: %s', valueSetName)
        return
      }
      f.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(globalValueSetInstance.elemID)
      const { value: globalValueSetValue } = globalValueSetInstance
      if (!isGlobalValueSetValue(globalValueSetValue)) {
        log.warn('Could not create restriction for GlobalValueSet %s, due to unknown value format: %o', valueSetName, globalValueSetValue)
        return
      }
      f.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
        enforce_value: true,
        values: globalValueSetValue.customValue.map(entry => entry[INSTANCE_FULL_NAME_FIELD]),
      })
    })
}

/**
 * Create filter that adds global value set references where needed
 */
const filterCreator: LocalFilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  /**
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const valueSetNameToRef = await multiIndex.keyByAsync({
      iter: awu(await referenceElements.getAll())
        .filter(isInstanceElement)
        .filter(isInstanceOfType(GLOBAL_VALUE_SET_METADATA_TYPE)),
      key: async inst => [await apiName(inst)],
      map: inst => inst,
    })
    const customObjects = elements.filter(isObjectType).filter(isCustomObject)
    customObjects.forEach(object => addRefAndRestrict(object, valueSetNameToRef))
  },
})

export default filterCreator
