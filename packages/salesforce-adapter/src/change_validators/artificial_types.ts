/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ChangeValidator, Element, getChangeData } from '@salto-io/adapter-api'
import { CURRENCY_CODE_TYPE_NAME } from '../constants'

const createCurrencyIsoCodeError = (element: Element): ChangeError => ({
  elemID: element.elemID,
  message: "The list of currency codes can't be changed via Salto.",
  detailedMessage:
    'To add or remove currency codes, follow the instructions at https://help.salesforce.com/s/articleView?id=sf.admin_currency.htm',
  severity: 'Error',
})

const changeValidator: ChangeValidator = async changes =>
  changes
    .map(getChangeData)
    .filter(element => element.elemID.typeName === CURRENCY_CODE_TYPE_NAME)
    .map(createCurrencyIsoCodeError)

export default changeValidator
