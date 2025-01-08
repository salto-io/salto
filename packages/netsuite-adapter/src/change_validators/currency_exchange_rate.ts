/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeError } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { EXCHANGE_RATE } from '../constants'
import { DEFAULT_EXCHANGE_RATE, getCurrencyAdditionsWithoutExchangeRate } from '../filters/currency_exchange_rate'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values

const changeValidator: NetsuiteChangeValidator = async changes =>
  getCurrencyAdditionsWithoutExchangeRate(changes)
    .map(
      instance =>
        ({
          elemID: instance.elemID,
          severity: 'Warning',
          message: `Currency ${EXCHANGE_RATE} is set with a default value`,
          detailedMessage: `'${EXCHANGE_RATE}' is omitted from fetch configuration by default. As this field has to be created in the target environment for this deployment to succeed, it will be deployed with a default value of ${DEFAULT_EXCHANGE_RATE}. Please make sure this value is set to your desired value in the NetSuite UI of the target environment after deploying. See https://help.salto.io/en/articles/6927221-salto-for-netsuite-overview#h_c2860cccee for more details.`,
        }) as ChangeError,
    )
    .filter(isDefined)

export default changeValidator
