/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  Change,
  ChangeDataType,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PRIORITY_TYPE_NAME } from '../constants'
import { removeDomainPrefix } from './avatars'

const filter: FilterCreator = ({ client }) => ({
  name: 'priorityFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(instance => !instance.value.isDefault)
      .forEach(instance => {
        delete instance.value.isDefault
      })
  },

  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(change => getChangeData(change).value.iconUrl !== undefined)
      .forEach(change => {
        change.data.after.value.iconUrl = new URL(getChangeData(change).value.iconUrl, client.baseUrl).href
      })
  },

  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(change => getChangeData(change).value.iconUrl !== undefined)
      .forEach(change => {
        change.data.after.value.iconUrl = removeDomainPrefix(getChangeData(change).value.iconUrl, client.baseUrl)
      })
  },
})

export default filter
