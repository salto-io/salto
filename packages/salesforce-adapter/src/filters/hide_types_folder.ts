/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, CORE_ANNOTATIONS, isObjectType } from '@salto-io/adapter-api'
import { SALESFORCE, TYPES_PATH } from '../constants'
import { FilterCreator } from '../filter'
import { ensureSafeFilterFetch } from './utils'

const isElementWithinTypesFolder = ({ path = [] }: Element): boolean =>
  path?.[0] === SALESFORCE && path?.[1] === TYPES_PATH

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'hideTypesFolder',
  onFetch: ensureSafeFilterFetch({
    config,
    filterName: 'hideTypesFolder',
    warningMessage: 'Error occurred when attempting to hide the Types Folder',
    fetchFilterFunc: async elements => {
      elements.filter(isElementWithinTypesFolder).forEach(element => {
        element.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        if (isObjectType(element)) {
          const objFields = Object.values(element.fields)
          objFields.forEach(f => {
            if (f.refType) {
              if (f.refType.type) {
                if (f.refType.type.annotations) {
                  f.refType.type.annotations[CORE_ANNOTATIONS.HIDDEN] = true
                }
              }
            }
          })
        }
      })
    },
  }),
})

export default filterCreator
