/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, isElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { UNIX_TIME_ZERO_STRING } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const removeUnixTimeZero = async (elements: Element[]): Promise<void> => {
  await awu(elements)
    .filter(isElement)
    .forEach(async e => {
      if (e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === UNIX_TIME_ZERO_STRING) {
        delete e.annotations[CORE_ANNOTATIONS.CHANGED_AT]
        log.trace('Removed unix time 0 last modified of %s', await apiName(e))
      }
      if (e.annotations[CORE_ANNOTATIONS.CREATED_AT] === UNIX_TIME_ZERO_STRING) {
        delete e.annotations[CORE_ANNOTATIONS.CREATED_AT]
        log.trace('Removed unix time 0 create time of %s', await apiName(e))
      }
    })
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: LocalFilterCreator = () => ({
  name: 'removeUnixTimeZero',
  onFetch: async (elements: Element[]) => {
    await removeUnixTimeZero(elements)
  },
})

export default filter
