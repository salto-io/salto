/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { SETTINGS_TYPE_PREFIX } from '../constants'

const sortRoleAttributes = (role: InstanceElement): void => {
  if (Array.isArray(role.value.attributes)) {
    role.value.attributes = _.sortBy(role.value.attributes, attr => [attr.scope, attr.name, attr.activationLevel])
  }
}

const sortCards = (gateway: InstanceElement): void => {
  ;['cardsAllowed', 'cardsAccepted'].forEach(fieldName => {
    if (Array.isArray(gateway.value[fieldName]) && gateway.value[fieldName].every(_.isString)) {
      gateway.value[fieldName] = gateway.value[fieldName].slice().sort()
    }
  })
}

/**
 * Sort lists whose order changes between fetches, to avoid unneeded noise.
 */
const filterCreator: FilterCreator = () => ({
  name: 'sortUnorderedListFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const roleInstances = elements
      .filter(isInstanceElement)
      .filter(e => e.refType.elemID.name === `${SETTINGS_TYPE_PREFIX}Role`)
    roleInstances.forEach(sortRoleAttributes)

    const settingsGatewayInstances = elements
      .filter(isInstanceElement)
      .filter(e => e.refType.elemID.name === `${SETTINGS_TYPE_PREFIX}Gateway`)
    settingsGatewayInstances.forEach(sortCards)
  },
})

export default filterCreator
