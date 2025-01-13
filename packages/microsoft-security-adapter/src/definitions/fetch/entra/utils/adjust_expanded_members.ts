/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ODATA_TYPE_FIELD, entraConstants } from '../../../../constants'
import { AdjustFunctionSingle } from '../../shared/types'

const { SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME } = entraConstants

export const adjustEntitiesWithExpandedMembers: AdjustFunctionSingle = async ({ value, typeName }) => {
  validatePlainObject(value, typeName)
  const members = _.get(value, 'members', [])
  validateArray(members, `${typeName} members`)

  const supportedDirectoryObjectODataTypeNames = Object.keys(SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME)
  return {
    value: {
      ...value,
      members: members
        .map((member: unknown): object => {
          validatePlainObject(member, `${typeName} member`)
          return _.pick(member, ['id', ODATA_TYPE_FIELD])
        })
        .filter((member: object) => supportedDirectoryObjectODataTypeNames.includes(_.get(member, ODATA_TYPE_FIELD))),
    },
  }
}
