/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { DASHBOARD_GADGET_TYPE, NOTIFICATION_SCHEME_TYPE_NAME, WEBHOOK_TYPE, WORKFLOW_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const RELEVANT_TYPES: string[] = [
  WORKFLOW_TYPE_NAME,
  DASHBOARD_GADGET_TYPE,
  WEBHOOK_TYPE,
  NOTIFICATION_SCHEME_TYPE_NAME,
]

const filter: FilterCreator = () => ({
  name: 'removeEmptyValuesFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => RELEVANT_TYPES.includes(instance.elemID.typeName))
      .forEach(async instance => {
        instance.value =
          (await transformValues({
            values: instance.value,
            type: await instance.getType(),
            transformFunc: ({ value }) => value,
            strict: false,
          })) ?? {}
      })
  },
})

export default filter
