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

import { ElemID, FixElementsFunc, isInstanceElement } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { ElementFixersHandler } from './element_fixers_handler'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../constants'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable

interface Fields {
  [key: string]: {
    description: string
    isHidden: boolean
    isRequired: boolean
  }
}

const removeMissingFields: ElementFixersHandler['fixElementFunc'] = ({ elementsSource })
  : FixElementsFunc => async elements => {
  const fixedElements = await awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .map(async instance => {
      if (instance.value.fields === undefined) {
        return undefined
      }

      const fixedInstance = instance.clone()
      fixedInstance.value.fields = await awu(Object.keys(instance.value.fields))
        .filter(async id => {
          const elemId = new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', id)
          return elementsSource.has(elemId)
        })
        .reduce((obj, key) => {
          obj[key] = instance.value.fields[key]
          return obj
        }, {} as Fields)

      if (Object.keys(fixedInstance.value.fields).length === Object.keys(instance.value.fields).length) {
        return undefined
      }
      return fixedInstance
    })
    .filter(values.isDefined)
    .toArray()

  const errors = fixedElements.map(instance => ({
    elemID: instance.elemID.createNestedID('fields'),
    severity: 'Info' as const,
    message: 'Deploying field configuration without all attached fields',
    detailedMessage: 'This field configuration is attached to some fields that do not exist in the target environment. It will be deployed without referencing these fields.',
  }))
  return { fixedElements, errors }
}

export const fieldConfigurationsHandler: ElementFixersHandler = {
  fixElementFunc: removeMissingFields,
}
