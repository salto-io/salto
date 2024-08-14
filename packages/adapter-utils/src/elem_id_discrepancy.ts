/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ElemIdGetter, ServiceIds } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)

export const getElemIdFuncWrapper = (func: ElemIdGetter): { getElemIdFunc: ElemIdGetter; logIdsFunc: () => void } => {
  const nonMatchingIdsMap: Map<string, string> = new Map()
  const logIdsFunc = (): void => {
    if (nonMatchingIdsMap.size === 0) {
      return
    }
    const diffsListString = Array.from(nonMatchingIdsMap.entries()).map(
      ([current, calculated]) => `current id: ${current} --- calculated id: ${calculated}`,
    )

    log.warn(
      `The following elements have differences between current elemId and calculated elemId:\n${diffsListString.slice(0, 100).join('\n')}`,
    )
  }

  const getElemIdFunc = (adapterName: string, serviceIds: ServiceIds, name: string): ElemID => {
    const res = func(adapterName, serviceIds, name)
    if (res.name !== name) {
      nonMatchingIdsMap.set(res.name, name)
    }
    if (res.name === name && nonMatchingIdsMap.get(res.name) !== undefined) {
      nonMatchingIdsMap.delete(res.name)
    }
    return res
  }
  return { logIdsFunc, getElemIdFunc }
}
