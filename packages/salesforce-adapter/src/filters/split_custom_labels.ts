/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, InstanceElement, isInstanceElement, isObjectType, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator, FilterWith } from '../filter'
import { RECORDS_PATH, SALESFORCE } from '../constants'


const log = logger(module)

type CustomLabel = Values & {
  fullName: string
}

type CustomLabels = Values & {
  labels: CustomLabel[]
}

type CustomLabelsInstance = InstanceElement & {
  value: CustomLabels
}

export const CUSTOM_LABELS = 'CustomLabels'
export const CUSTOM_LABEL = 'CustomLabel'

const isCustomLabelsInstance = (e: InstanceElement): e is CustomLabelsInstance => (
  e.elemID.typeName === CUSTOM_LABELS
)

/**
 * Split custom labels to individual instances
 */
const filterCreator: FilterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const customLabelType = elements
      .filter(isObjectType)
      .find(e => e.elemID.typeName === CUSTOM_LABEL)
    if (customLabelType === undefined) {
      log.warn('CustomLabel type does not exist, skipping split into CustomLabel instances')
      return
    }
    const customLabelsInstance = elements
      .filter(isInstanceElement)
      .find(isCustomLabelsInstance)
    if (customLabelsInstance === undefined) {
      log.warn('CustomLabels instance does not exist, skipping split into CustomLabel instances')
      return
    }
    const customLabelInstances = customLabelsInstance.value.labels
      .map(label => new InstanceElement(
        label.fullName,
        customLabelType,
        label,
        [SALESFORCE, RECORDS_PATH, CUSTOM_LABEL, label.fullName],
      ))
    _.pull(elements, customLabelsInstance)
    elements.push(...customLabelInstances)
  },
})

export default filterCreator
