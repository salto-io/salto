/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { values, collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeElement,
  InstanceElement, isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_STOP_VALUE } from '@salto-io/adapter-utils'
import { isCustomType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values

const hasAccountSpecificValue = (instance: InstanceElement): boolean => {
  let foundAccountSpecificValue = false
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_STOP_VALUE.SKIP
      }
      if (_.isString(value) && value.includes(ACCOUNT_SPECIFIC_VALUE)) {
        foundAccountSpecificValue = true
        return WALK_STOP_VALUE.EXIT
      }
      return WALK_STOP_VALUE.RECURSE
    },
  })
  return foundAccountSpecificValue
}

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(async change => {
      const instance = getChangeElement(change)
      if (!isCustomType(instance.refType.elemID)) {
        return undefined
      }
      if (!(await hasAccountSpecificValue(instance))) {
        return undefined
      }
      // We identified ACCOUNT_SPECIFIC_VALUE only in workflows and script related types,
      // e.g. clientscript, restlet etc.
      // These types have an isinactive field. If it indicates that the instance is enabled and
      // we deploy it, without the real value behind the ACCOUNT_SPECIFIC_VALUE, it might be
      // created invalid since some data is missing.
      // Since the SAAS doesn't present the validation output yet (SAAS-1542), we set it to ERROR.
      if (isAdditionChange(change) && !instance.value.isinactive) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'New instances that have fields with ACCOUNT_SPECIFIC_VALUE can be deployed only when they are inactive',
          detailedMessage: 'New instances that have fields with ACCOUNT_SPECIFIC_VALUE can be deployed only when they are inactive',
        } as ChangeError
      }
      return {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Fields with ACCOUNT_SPECIFIC_VALUE will be skipped and not deployed',
        detailedMessage: 'Fields with ACCOUNT_SPECIFIC_VALUE will be skipped and not deployed',
      } as ChangeError
    })
    .filter(isDefined)
    .toArray()
)

export default changeValidator
