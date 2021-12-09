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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { ACCOUNTING_CODE_ITEM_TYPE, PRODUCT_RATE_PLAN_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const { isDefined } = values

const addFinanceInformationDependencies = (
  inst: InstanceElement,
  accountingCodeItems: InstanceElement[]
): void => {
  const { productRatePlanCharges } = inst.value
  if (!_.isArray(productRatePlanCharges)) {
    return
  }

  productRatePlanCharges.forEach(charge => {
    const { financeInformation } = charge
    if (!_.isPlainObject(financeInformation)) {
      return
    }

    Object.keys(financeInformation)
      // financeInformation fields comes in couples - '.*AccountingCode' and '.*AccountingCodeType'
      // for example:
      // deferredRevenueAccountingCode & deferredRevenueAccountingCodeType
      // recognizedRevenueAccountingCode & recognizedRevenueAccountingCodeType
      .filter(key => /^.*AccountingCode$/.test(key))
      .forEach(key => {
        // each couple of fields (as mentioned above) refer to an accountingCodeItem
        // with a unique combination of name & type
        const accountingCodeItem = accountingCodeItems.find(item =>
          item.value.name === financeInformation[key] && item.value.type === financeInformation[`${key}Type`])
        if (isDefined(accountingCodeItem)) {
          // one field should be with with a reference, and the second is unnecessary
          financeInformation[key] = new ReferenceExpression(accountingCodeItem.elemID)
          _.unset(financeInformation, `${key}Type`)
        }
      })
  })
}

/**
 * Add references to fields in financeInformation
 * (an object field in ProductRatePlan->ProductRatePlanCharges)
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)

    const productRatePlanInstances = instances
      .filter(inst => inst.elemID.typeName === PRODUCT_RATE_PLAN_TYPE)

    const accountingCodeItems = instances.filter(inst =>
      inst.elemID.typeName === ACCOUNTING_CODE_ITEM_TYPE)
    if (_.isEmpty(productRatePlanInstances) || _.isEmpty(accountingCodeItems)) {
      return
    }

    productRatePlanInstances.forEach(inst => {
      addFinanceInformationDependencies(inst, accountingCodeItems)
    })
  },
})

export default filterCreator
