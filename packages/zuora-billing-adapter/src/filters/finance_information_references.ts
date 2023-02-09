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
import _ from 'lodash'
import { Element, ElemID, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { collections, multiIndex, values } from '@salto-io/lowerdash'
import { ACCOUNTING_CODE_ITEM_TYPE, PRODUCT_RATE_PLAN_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const { isDefined } = values
const { toAsyncIterable } = collections.asynciterable

const addFinanceInformationDependencies = (
  inst: InstanceElement,
  accountingCodeItemsLookup: multiIndex.Index<[string, string], ElemID>
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

    const references: Record<string, ReferenceExpression> = {}
    Object.keys(financeInformation)
      // financeInformation fields comes in couples - '.*AccountingCode' and '.*AccountingCodeType'
      // for example:
      // deferredRevenueAccountingCode & deferredRevenueAccountingCodeType
      // recognizedRevenueAccountingCode & recognizedRevenueAccountingCodeType
      .filter(key => /^.*AccountingCode$/.test(key))
      .forEach(key => {
        // each couple of fields (as mentioned above) refer to an accountingCodeItem
        // with a unique combination of name & type
        const accountingCodeItem = accountingCodeItemsLookup.get(
          financeInformation[key]?.toLowerCase(), financeInformation[`${key}Type`]?.toLowerCase()
        )
        if (isDefined(accountingCodeItem)) {
          references[key] = new ReferenceExpression(accountingCodeItem)
        }
      })

    charge.financeInformation = _.merge(
      // TODO: when this adapter would be able to deploy,
      // those fields should be created on preDeploy
      // so they won't considered as deleted at the service
      _.omit(financeInformation, Object.keys(references).map(key => `${key}Type`)),
      references,
    )
  })
}

/**
 * Add references to fields in financeInformation
 * (an object field in ProductRatePlan->ProductRatePlanCharges)
 */
const filterCreator: FilterCreator = () => ({
  name: 'addFinanceInformationReferencesFilter',
  // TODO: in preDeploy - create the deleted fields in the pattern of '.*AccountingCodeType'
  // from the 'type' value of the referred AccountingCodeItem in the fields in the pattern of
  // '.*AccountingCode'.
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)

    const productRatePlanInstances = instances.filter(
      inst => inst.elemID.typeName === PRODUCT_RATE_PLAN_TYPE
    )

    const accountingCodeItems = instances.filter(
      inst => inst.elemID.typeName === ACCOUNTING_CODE_ITEM_TYPE
    )

    if (_.isEmpty(productRatePlanInstances) || _.isEmpty(accountingCodeItems)) {
      return
    }

    const { accountingCodeItemsLookup } = await multiIndex.buildMultiIndex<Element>()
      .addIndex({
        name: 'accountingCodeItemsLookup',
        filter: isInstanceElement,
        // we want to look for the AccountingCodeItem by its name & type
        // (they're unique for each instance)
        key: item => [item.value.name.toLowerCase(), item.value.type.toLowerCase()],
        map: item => item.elemID,
      }).process(toAsyncIterable(accountingCodeItems))

    productRatePlanInstances.forEach(inst => {
      addFinanceInformationDependencies(inst, accountingCodeItemsLookup)
    })
  },
})

export default filterCreator
