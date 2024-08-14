/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, isInstanceChange, getChangeData, InstanceElement, isAdditionChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { CURRENCY } from '../constants'
import { LocalFilterCreator } from '../filter'

export const FIELDS_TO_OMIT = ['currencyPrecision', 'locale', 'formatSample']

const filterCreator: LocalFilterCreator = () => ({
  name: 'currencyUndeployableFieldsFilter',
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(async change => getChangeData<InstanceElement>(change).elemID.typeName === CURRENCY)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(change, element => {
          element.value = _.omit(element.value, FIELDS_TO_OMIT)
          return element
        }),
      )
  },
})

export default filterCreator
