/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import {
  adjustCategoryObjectToCategoryId,
  removeIdsForScriptsObjectArray,
  adjustServiceIdToTopLevel,
  adjustSiteObjectToSiteId,
  removeSelfServiceIcon,
} from './utils'

/*
 * Adjust policy instance
 */
export const adjust: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  ;[
    adjustCategoryObjectToCategoryId,
    adjustSiteObjectToSiteId,
    removeIdsForScriptsObjectArray,
    adjustServiceIdToTopLevel,
    removeSelfServiceIcon,
  ].forEach(fn => fn(value))
  return { value }
}
