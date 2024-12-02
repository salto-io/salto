/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { regex as lowerdashRegex } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { PERMISSION_SCHEME_TYPE_NAME } from '../../constants'
import { isPermissionSchemeStructure, PermissionHolder } from './omit_permissions_common'

export const isPermissionScheme = (element: Element): boolean => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME

const TYPES_AND_VALUES_TO_SORT: Record<string, string[]> = {
  VIEW_PROJECTS: ['.*'],
  VIEW_ISSUES: ['.*'],
}

const unsupportedPermissionSchemes = (permissionHolder: PermissionHolder): boolean =>
  permissionHolder.permission in TYPES_AND_VALUES_TO_SORT &&
  TYPES_AND_VALUES_TO_SORT[permissionHolder.permission].some(matcher =>
    lowerdashRegex.isFullRegexMatch(permissionHolder.holder.type, matcher),
  )
/**
 * Remove unsupported permissions from permission schemes
 */
const filter: FilterCreator = () => ({
  name: 'forbiddenPermissionSchemeFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isPermissionScheme)
      .filter(isInstanceElement)
      .forEach(element => {
        _.remove(
          element.value.permissions,
          permissionHolder =>
            isPermissionSchemeStructure(permissionHolder) && unsupportedPermissionSchemes(permissionHolder),
        )
      })
  },
})

export default filter
