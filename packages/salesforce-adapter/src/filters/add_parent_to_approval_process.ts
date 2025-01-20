/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { Element } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import {
  addElementParentReference,
  apiNameSync,
  buildElementsSourceForFetch,
  isCustomObjectSync,
  isInstanceOfTypeSync,
} from './utils'
import { APPROVAL_PROCESS_METADATA_TYPE } from '../constants'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable

const filter: FilterCreator = ({ config }) => ({
  name: 'addParentToApprovalProcess',
  onFetch: async (elements: Element[]) => {
    const customObjectByName = _.keyBy(
      (await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll())).filter(isCustomObjectSync),
      objectType => apiNameSync(objectType) ?? '',
    )
    const createdReferencesCount: number = elements
      .filter(isInstanceOfTypeSync(APPROVAL_PROCESS_METADATA_TYPE))
      .reduce((acc, approvalProcess) => {
        const apiName = apiNameSync(approvalProcess)
        if (apiName !== undefined) {
          const parent = customObjectByName[apiName.split('.')[0]]
          if (parent !== undefined) {
            addElementParentReference(approvalProcess, parent)
            return acc + 1
          }
          log.warn(
            'could not add parent reference to instance %s, the object %s is missing from the workspace',
            approvalProcess.elemID.getFullName(),
            apiName,
          )
        }
        return acc
      }, 0)
    log.debug('filter created %d references in total', createdReferencesCount)
  },
})

export default filter
