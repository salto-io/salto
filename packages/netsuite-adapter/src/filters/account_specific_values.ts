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
import { isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformElement, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { isCustomRecordType, isStandardType } from '../types'
import { FilterWith } from '../filter'
import { ACCOUNT_SPECIFIC_VALUE, APPLICATION_ID } from '../constants'

const { awu } = collections.asynciterable

const transformFunc: TransformFunc = ({ value }) => (
  _.isString(value) && value.includes(ACCOUNT_SPECIFIC_VALUE)
    ? undefined
    : value
)

const filterCreator = (): FilterWith<'preDeploy'> => ({
  name: 'accountSpecificValues',
  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (
              isObjectType(element)
              && isCustomRecordType(element)
              // customRecordTypes that are not from a suite app are handled
              // using the accountspecificvalues flag
              && element.annotations[APPLICATION_ID] !== undefined
            ) {
              const newElement = await transformElement({
                element,
                strict: false,
                transformFunc,
              })
              element.annotations = newElement.annotations
              Object.entries(newElement.fields).forEach(([fieldName, field]) => {
                if (element.fields[fieldName]) {
                  element.fields[fieldName].annotations = field.annotations
                }
              })
            }
            if (
              isInstanceElement(element)
              && isStandardType((await element.getType()))
              // instances that are not from a suite app are handled
              // using the accountspecificvalues flag
              && element.value[APPLICATION_ID] !== undefined
            ) {
              element.value = await transformValues({
                values: element.value,
                type: await element.getType(),
                strict: false,
                transformFunc,
              }) ?? element.value
            }
            return element
          }
        ))
  },
})

export default filterCreator
