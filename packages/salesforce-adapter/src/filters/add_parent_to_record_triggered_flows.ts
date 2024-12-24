/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Element, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  isInstanceOfTypeSync,
  addElementParentReference,
  isCustomObjectSync,
} from './utils'
import { FLOW_METADATA_TYPE } from '../constants'

const { isDefined } = lowerDashValues
const { toArrayAsync } = collections.asynciterable
const log = logger(module)

type RecordTriggeredFlowInstance = InstanceElement & {
  value: {
    start: {
      object: string
    }
  }
}

const isRecordTriggeredFlowInstance = (element: Element): element is RecordTriggeredFlowInstance =>
  isInstanceOfTypeSync(FLOW_METADATA_TYPE)(element) && _.isString(_.get(element.value, ['start', 'object']))

const filter: FilterCreator = ({ config }) => ({
  name: 'addParentToRecordTriggeredFlows',
  onFetch: async (elements: Element[]) => {
    if (!config.fetchProfile.isFeatureEnabled('addParentToRecordTriggeredFlows')) {
      return
    }
    const customObjectByName = _.keyBy(
      (await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll())).filter(isCustomObjectSync),
      objectType => apiNameSync(objectType) ?? '',
    )
    const createdReferencesCount: number = elements.filter(isRecordTriggeredFlowInstance).reduce((acc, flow) => {
      const parent = customObjectByName[flow.value.start.object]
      if (isDefined(parent)) {
        addElementParentReference(flow, parent)
        return acc + 1
      }
      log.warn(
        'could not add parent reference to instance %s, the object %s is missing from the workspace',
        flow,
        flow.value.start.object,
      )
      return acc
    }, 0)
    log.debug('filter created %d references in total', createdReferencesCount)
  },
})

export default filter
