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
import { ElemID, ElemIdGetter, ServiceIds } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'


const log = logger(module)

export const getElemIdFuncWrapper = (func: ElemIdGetter): {getElemIdFunc: ElemIdGetter; logIdsFunc: () => void} => {
  const nonMatchingIdsMap: Record<string, string> = {}
  const logIdsFunc = (): void => {
    if (Object.keys(nonMatchingIdsMap).length === 0) {
      return
    }
    const diffsListString = Object.keys(nonMatchingIdsMap).map(current => {
      const calculated = nonMatchingIdsMap[current]
      return `current id: ${current} --- calculated id: ${calculated}`
    })
    log.warn(`The following elements have differences between current elemId and calculated elemId:\n${diffsListString.join('\n')}`)
  }

  const getElemIdFunc = (adapterName: string, serviceIds: ServiceIds, name: string): ElemID => {
    const res = func(adapterName, serviceIds, name)
    if (res.name !== name) {
      nonMatchingIdsMap[res.name] = name
    }
    if ((res.name === name) && nonMatchingIdsMap[res.name] !== undefined) {
      delete nonMatchingIdsMap[res.name]
    }
    return res
  }
  return { logIdsFunc, getElemIdFunc }
}
