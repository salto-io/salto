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

import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { CURRENCY } from '../constants'
import { DEFAULT_EXCHANGE_RATE } from '../filters/currency_exchange_rate'

const { isDefined } = values

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(change => getChangeData<InstanceElement>(change))
    .filter(instance => instance.elemID.typeName === CURRENCY)
    .map(instance => {
      if (!instance.value?.exchangeRate) {
        return {
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Currency exchangeRate is set with a default value',
          detailedMessage: `'exchangeRate' is omitted from fetch configuration by default. As this field has to be created in the target environment for this deployment to succeed, it will be deployed with a default value of ${DEFAULT_EXCHANGE_RATE}. Please make sure this value is set to your desired value in the NetSuite UI of the target environment after deploying. See https://docs.salto.io/docs/netsuite#overriding-configuration-values for more details.`,
        } as ChangeError
      }
      return undefined
    })
    .filter(isDefined)
)

export default changeValidator
