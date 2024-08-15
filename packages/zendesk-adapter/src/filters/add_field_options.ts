/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { applyforInstanceChangesOfType } from './utils'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME, ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME } from '../constants'

const { makeArray } = collections.array

const RELEVANT_TYPE_NAMES = [ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME]

const filterCreator: FilterCreator = () => ({
  name: 'addFieldOptionsFilter',
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, RELEVANT_TYPE_NAMES, (instance: InstanceElement) => {
      makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).forEach(option => {
        if (option.id === undefined) {
          option.id = null
        }
      })
      return instance
    })
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, RELEVANT_TYPE_NAMES, (instance: InstanceElement) => {
      makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).forEach(option => {
        if (option.id === null) {
          delete option.id
        }
      })
      return instance
    })
  },
})

export default filterCreator
