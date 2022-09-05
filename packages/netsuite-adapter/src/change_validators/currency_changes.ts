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

import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { CURRENCY } from '../constants'

const { isDefined } = values

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === CURRENCY)
    .map(instance => {
      if (!instance.value.overrideCurrencyFormat) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Element contains instance that cannot be deployed.',
          detailedMessage: 'The currency\'s \'OVERRIDE CURRENCY FORMAT\' is disabled and therfore cannot be deployed.',
        } as ChangeError
      }
      const fieldsToOmit = ['currencyPrecision', 'locale', 'formatSample']
      return {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Element contains fields that cannot be deployed. These fields will be skipped from the deployment.',
        detailedMessage: `The ${fieldsToOmit.join(' ,')} fields cannot be deployed and will be skipped. Please edit locale manually in the service.`,
      } as ChangeError
    })
    .filter(isDefined)
)

export default changeValidator
