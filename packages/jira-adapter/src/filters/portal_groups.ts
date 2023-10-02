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

import { getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { PORTAL_GROUP_TYPE } from '../constants'

const { awu } = collections.asynciterable

const filter: FilterCreator = ({ config }) => ({
  name: 'portalGroupsFilter',
  preDeploy: async changes => {
    if (!config.fetch.enableJSM) {
      return
    }
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === PORTAL_GROUP_TYPE)
      .forEach(change => {
        const instance = getChangeData(change)
        instance.value.ticketTypeIds = []
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableJSM) {
      return
    }
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === PORTAL_GROUP_TYPE)
      .forEach(change => {
        const instance = getChangeData(change)
        delete instance.value.ticketTypeIds
      })
  },
})
export default filter
