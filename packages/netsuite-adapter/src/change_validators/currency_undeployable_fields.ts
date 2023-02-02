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
  AdditionChange,
  ChangeError,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { CURRENCY } from '../constants'
import { NetsuiteChangeValidator } from './types'


const { isDefined } = values
const DISPLAY_SYMBOL = 'display symbol'
const SYMBOL_PLACEMENT = 'symbol placement'


const validateModificationChange = (
  change: ModificationChange<InstanceElement>
): ChangeError | undefined => {
  const { before, after } = change.data
  if (before.value.currencyPrecision !== after.value.currencyPrecision) {
    return {
      elemID: before.elemID,
      severity: 'Error',
      message: 'Editing of \'currencyPrecision\' is not supported',
      detailedMessage: 'Cannot deploy currency - currency precision is a read-only field in NetSuite. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions',
    }
  }
  if ((before.value.displaySymbol !== after.value.displaySymbol
    || before.value.symbolPlacement !== after.value.symbolPlacement)
  && !before.value.overrideCurrencyFormat) {
    const changedField = before.value.displaySymbol !== after.value.displaySymbol ? DISPLAY_SYMBOL : SYMBOL_PLACEMENT
    return {
      elemID: before.elemID,
      severity: 'Error',
      message: 'Currency contains a field that cannot be edited.',
      detailedMessage: `Cannot deploy currency - field ${changedField} cannot be edited. To enable editing this field, enable override currency format and try again. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions`,
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
      detailedMessage: 'Cannot deploy currency - override currency format is disabled. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions',
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: 'Currency contains fields that cannot be deployed. These fields will be skipped from the deployment.',
    detailedMessage: 'Unable to deploy \'locale\' field. Once the deployment is completed, set the \'locale\' of the newly created currency to the desired value in the target environment.',
    deployActions: {
      postAction: {
        title: 'Edit \'locale\' field',
        description: 'Set the \'locale\' of the newly created currency to the desired value',
        subActions: [
          'Within the NetSuite UI, navigate to Lists > Accounting > Currencies',
          `Choose the newly created currency (${instance.value.name})`,
          'Set \'DEFAULT LOCALE\' to the correct value',
        ],
      },
    },
  }
}

const changeValidator: NetsuiteChangeValidator = async changes => (
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
