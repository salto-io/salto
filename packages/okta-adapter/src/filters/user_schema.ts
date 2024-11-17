/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  InstanceElement,
  isInstanceChange,
  getChangeData,
  Change,
  isAdditionChange,
  AdditionChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { USER_SCHEMA_TYPE_NAME, LINKS_FIELD } from '../constants'
import { extractIdFromUrl } from '../utils'
import { isUserType } from '../definitions/fetch/types/user_type'

const log = logger(module)
const { awu } = collections.asynciterable

/**
 * Update UserSchema with its correct id taken from the parent UserType
 */
const filter: FilterCreator = () => ({
  name: 'userSchemaFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .forEach(async change => {
        const userTypeValues = getParents(getChangeData(change))?.[0]
        if (!isUserType(userTypeValues)) {
          log.error(
            `Failed to find matching UserType instance for UserSchema: ${getChangeData(change).elemID.getFullName()}, can not updadate id`,
          )
          return
        }
        // get schemaId from the parent UserType _links object
        const schemaId = extractIdFromUrl(userTypeValues[LINKS_FIELD].schema.href)
        await applyFunctionToChangeData<AdditionChange<InstanceElement>>(change, async instance => {
          instance.value.id = schemaId
          return instance
        })
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .forEach(async change => {
        // The id returned from the service includes the base url, update the field to include only the id
        const id = extractIdFromUrl(getChangeData(change).value.id)
        if (!_.isString(id)) {
          log.error(`Failed to update id for UserSchema instance: ${getChangeData(change).elemID.getFullName()}`)
          return
        }
        await applyFunctionToChangeData<AdditionChange<InstanceElement>>(change, async instance => {
          instance.value.id = id
          return instance
        })
      })
  },
})

export default filter
