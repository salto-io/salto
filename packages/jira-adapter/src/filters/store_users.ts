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
import { logger } from '@salto-io/logging'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, MapType, ObjectType } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { JIRA } from '../constants'
import { UserMap } from '../users'

const log = logger(module)

const userInfoType = new ObjectType({
  elemID: new ElemID(JIRA, 'UserInfo'),
  fields: {
    locale: { refType: BuiltinTypes.STRING },
    displayName: { refType: BuiltinTypes.STRING },
    email: { refType: BuiltinTypes.STRING },
    username: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

const usersType = new ObjectType({
  elemID: new ElemID(JIRA, 'Users'),
  fields: {
    users: { refType: new MapType(userInfoType) },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

const getUsers = (userMap: UserMap | undefined): InstanceElement =>
  new InstanceElement(
    'users',
    usersType,
    { users: userMap },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )


/*
 * stores the fetched users to an hidden nacl
*/
const filter: FilterCreator = ({ getUserMapFunc }) => ({
  name: 'storeUsers',
  onFetch: async elements => log.time(async () => {
    try {
      const usersMap = await getUserMapFunc()
      elements.push(userInfoType, usersType, getUsers(usersMap))
    } catch (e) {
      log.error('failed to fetch users', e)
    }
  }, 'store users filter'),
})
export default filter
