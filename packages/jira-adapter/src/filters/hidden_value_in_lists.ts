/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const isStringNumber = (value: string): boolean => !Number.isNaN(Number(value))

/**
 * Remove hidden value from lists, since core does not support it
 */
const filter: FilterCreator = () => ({
  name: 'hiddenValuesInListsFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value =
          (await transformValues({
            values: instance.value,
            type: await instance.getType(),
            pathID: instance.elemID,
            allowEmptyArrays: true,
            allowEmptyObjects: true,
            strict: false,
            transformFunc: ({ value, field, path }) => {
              const isInArray = path?.getFullNameParts().some(isStringNumber)
              if (isInArray && field?.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]) {
                return undefined
              }
              return value
            },
          })) ?? {}
      })
  },
})

export default filter
