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
  AdditionChange,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { CURRENCY } from '../constants'

const { isDefined } = values


const validateModificationChange = (
  change: ModificationChange<InstanceElement>
): ChangeError | undefined => {
  const { before, after } = change.data
  if (before.value.currencyPrecision !== after.value.currencyPrecision) {
    return {
      elemID: before.elemID,
      severity: 'Error',
      message: 'Editing of \'currencyPrecision\' is not supported',
      detailedMessage: 'Failed to deploy - currency precision is a read-only field in NetSuite. Please see https://docs.salto.io/docs/netsuite#deploy-troubleshooting for instructions',
    }
  }
  if ((before.value.displaySymbol !== after.value.displaySymbol
    || before.value.symbolPlacement !== after.value.symbolPlacement)
  && !before.value.overrideCurrencyFormat) {
    return {
      elemID: before.elemID,
      severity: 'Error',
      message: 'Currency contains a field that cannot be deployed.',
      detailedMessage: 'Failed to deploy - override currency format is disabled. Please see https://docs.salto.io/docs/netsuite#deploy-troubleshooting for instructions',
    }
  }
  return undefined
}

const validateAdditionChange = (additionChange: AdditionChange<InstanceElement>): ChangeError => {
  const instance = additionChange.data.after
  if (!instance.value.overrideCurrencyFormat) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Currency contains a field that cannot be deployed.',
      detailedMessage: 'Failed to deploy - override currency format is disabled. Please see https://docs.salto.io/docs/netsuite#deploy-troubleshooting for instructions',
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: 'Currency contains fields that cannot be deployed. These fields will be skipped from the deployment.',
    detailedMessage: 'Unable to deploy \'locale\' field. Please set the \'locale\' of the created currency to the desired value in the tartget enviroment.',
  }
}

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(elem => getChangeData(elem).elemID.typeName === CURRENCY)
    .map(change => {
      if (isModificationChange(change)) {
        return validateModificationChange(change)
      }
      return validateAdditionChange(change)
    })
    .filter(isDefined)
)

export default changeValidator
