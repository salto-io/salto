/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, MapType, ObjectType } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { JIRA, USERS_INSTANCE_NAME, USERS_TYPE_NAME } from '../constants'

const log = logger(module)

/*
 * stores the fetched users to an hidden nacl
 */
const filter: FilterCreator = ({ config, getUserMapFunc }) => ({
  name: 'storeUsers',
  onFetch: async elements => {
    if (!(config.fetch.convertUsersIds ?? true)) {
      return
    }
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
      elemID: new ElemID(JIRA, USERS_TYPE_NAME),
      fields: {
        users: { refType: new MapType(userInfoType) },
      },
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      },
    })

    try {
      const usersMap = await getUserMapFunc()
      const usersInstance = new InstanceElement(USERS_INSTANCE_NAME, usersType, { users: usersMap }, undefined, {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      })
      elements.push(userInfoType, usersType, usersInstance)
    } catch (e) {
      log.error('failed to fetch users', e)
    }
  },
})
export default filter
