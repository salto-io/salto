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
import { isStandardType } from '../types'
import { LocalFilterCreator } from '../filter'

const { awu } = collections.asynciterable

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'omitSdfUntypedValues',
  onFetch: async elements => {
    // the default behavior is strictInstanceStructure=false
    if (!config.fetch.strictInstanceStructure) {
      return
    }
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => isStandardType(instance.refType))
      .forEach(async instance => {
        // running transformValues with strict=true omits all untyped values
        instance.value =
          (await transformValues({
            values: instance.value,
            type: await instance.getType(),
            transformFunc: ({ value }) => value,
            strict: true,
          })) ?? instance.value
      })
  },
})

export default filterCreator
