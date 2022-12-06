/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

export type IdMap = Record<string, string>
export type GetIdMapFunc = () => Promise<IdMap>

export const getIdMapFuncCreator = (paginator: clientUtils.Paginator, isDataCenter: boolean)
    : GetIdMapFunc => {
  let idMap: IdMap
  let usersCallPromise: Promise<clientUtils.ResponseValue[][]>
  return async (): Promise<IdMap> => {
    if (idMap === undefined) {
      if (usersCallPromise === undefined) {
        let paginationArgs
        if (isDataCenter) {
          paginationArgs = {
            url: '/rest/api/2/user/search?username=.',
          }
        } else {
          paginationArgs = {
            url: '/rest/api/3/users/search',
            paginationField: 'startAt',
          }
        }
        usersCallPromise = toArrayAsync(paginator(
          paginationArgs,
          page => makeArray(page) as clientUtils.ResponseValue[]
        ))
      }
      if (isDataCenter) {
        idMap = Object.fromEntries((await usersCallPromise)
          .flat()
          .filter(user => user.key !== undefined)
          .map(user => [[user.key, user.name], [user.name, user.key]].flat()))
      } else {
        idMap = Object.fromEntries((await usersCallPromise)
          .flat()
          .filter(user => user.accountId !== undefined)
          .map(user => [user.accountId, user.displayName]))
      }
    }
    return idMap
  }
}
