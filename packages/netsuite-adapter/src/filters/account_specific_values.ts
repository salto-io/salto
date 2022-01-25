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
import { isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { isCustomType } from '../types'
import { FilterWith } from '../filter'
import { ACCOUNT_SPECIFIC_VALUE, APPLICATION_ID } from '../constants'

const { awu } = collections.asynciterable


const filterCreator = (): FilterWith<'preDeploy'> => ({
  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (!isInstanceElement(element)
              || !isCustomType((await element.getType()).elemID)
              // instances that are not from a suite app are handled
              // using the accountspecificvalues flag
              || element.value[APPLICATION_ID] === undefined) {
              return element
            }

            element.value = await transformValues({
              values: element.value,
              type: await element.getType(),
              strict: false,
              pathID: element.elemID,
              transformFunc: async ({ value }) =>
                (_.isString(value) && value.includes(ACCOUNT_SPECIFIC_VALUE) ? undefined : value),
            }) ?? element.value

            return element
          }
        ))
  },
})

export default filterCreator
