/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { TYPE_NAME_TO_USER_FIELDS } from '../../filters/groups_and_users_filter'
import { validateValue } from './generic'

/**
 * AdjustFunction that runs upon fetch and change user references structure
 * so object type will be aligned with the structure yield by "groups_and_users_filter".
 */
export const createAdjustUserReferences: (typeName: string) => definitions.AdjustFunctionSingle =
  typeName => async args => {
    const value = validateValue(args.value)
    const userFields = TYPE_NAME_TO_USER_FIELDS[typeName]
    userFields.forEach(field => {
      value[field] = {
        accountId: value[field],
        displayName: value[field],
      }
    })
    return { ...args, value }
  }

/**
 * AdjustFunction that runs upon deploy and change user references structure to fit deploy api
 */
export const createAdjustUserReferencesReverse: (
  typeName: string,
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = typeName => async args => {
  const value = validateValue(args.value)
  const userFields = TYPE_NAME_TO_USER_FIELDS[typeName]
  userFields.forEach(field => {
    value[field] = _.get(value, `${field}.accountId`)
  })
  return { ...args, value }
}
