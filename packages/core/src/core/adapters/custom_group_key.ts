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
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { AdapterOperations, ChangeGroupId, ChangeGroupIdFunction, ChangeId } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)

export const getAdapterChangeGroupIdFunctions = (
  adapters: Record<string, AdapterOperations>
): Record<string, ChangeGroupIdFunction> =>
  _(adapters)
    .mapValues(adapter => adapter.deployModifiers?.getChangeGroupIds)
    .pickBy(values.isDefined)
    // Add the account name prefix to the change group ids to avoid collisions between accounts
    .mapValues((func, accountName) => new Proxy(func, {
      apply: (target, thisArg, args) => target.apply(thisArg, args)
        .then(result => {
          log.debug(`Adding account name prefix to change group ids for account ${accountName}`)
          const changesWithAccountNamePrefix = new Map<ChangeId, ChangeGroupId>()
          result.changeGroupIdMap.forEach((groupId, changeId) => {
            changesWithAccountNamePrefix.set(
              changeId,
              `${accountName}__${groupId}`
            )
          })
          return Object.assign(result, { changeGroupIdMap: changesWithAccountNamePrefix })
        }),
    }))
    .value()
