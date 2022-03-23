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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { isCustomType } from '../types'
import { NOT_YET_SUPPORTED_VALUE } from '../constants'

const { awu } = collections.asynciterable

const isInstanceContainStringValue = (
  instance: InstanceElement, expectedValue: string
): boolean => {
  let foundValue = false
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isString(value) && value.includes(expectedValue)) {
        foundValue = true
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return foundValue
}


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => isCustomType(instance.refType))
    .filter(instance => isInstanceContainStringValue(instance, NOT_YET_SUPPORTED_VALUE))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Instance has an NOT_YET_SUPPORTED value that Salto cannot deploy',
      detailedMessage: `Instance ${instance.elemID.getFullName()} has a NOT_YET_SUPPORTED value that Salto cannot deploy. In order to deploy the instance, please fill the NOT_YET_SUPPORTED value`,
    } as ChangeError))
    .toArray()
)

export default changeValidator
