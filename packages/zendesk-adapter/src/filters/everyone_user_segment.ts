/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { InstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { EVERYONE_USER_TYPE, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'
import { FETCH_CONFIG, isGuideEnabled } from '../config'

const log = logger(module)
const { RECORDS_PATH } = elementsUtils

export const createEveryoneUserSegmentInstance = (userSegmentType: ObjectType): InstanceElement =>
  new InstanceElement(
    EVERYONE_USER_TYPE,
    userSegmentType,
    { user_type: EVERYONE_USER_TYPE, built_in: true, name: EVERYONE_USER_TYPE },
    [ZENDESK, RECORDS_PATH, USER_SEGMENT_TYPE_NAME, EVERYONE_USER_TYPE],
  )

/**
 * Adds a user_segment for "Everyone" entity
 */
const filterCreator: FilterCreator = ({ config, fetchQuery }) => ({
  name: 'everyoneUserSegmentFilter',
  onFetch: async elements => {
    if (!isGuideEnabled(config[FETCH_CONFIG]) || !fetchQuery.isTypeMatch(USER_SEGMENT_TYPE_NAME)) {
      return
    }
    const userSegmentType = elements
      .filter(element => element.elemID.typeName === USER_SEGMENT_TYPE_NAME)
      .find(isObjectType)
    if (userSegmentType === undefined) {
      log.error("Couldn't find user_segment type.")
      return
    }
    const everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(userSegmentType)
    elements.push(everyoneUserSegmentInstance)
  },
})

export default filterCreator
