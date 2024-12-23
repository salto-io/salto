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
import { Element, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { apiNameSync, buildElementsSourceForFetch, isInstanceOfTypeSync, addElementParentReference } from './utils'
import { CUSTOM_OBJECT, FLOW_METADATA_TYPE } from '../constants'

const { isDefined } = lowerDashValues
const { toArrayAsync } = collections.asynciterable
const log = logger(module)

type RecordsIndex = Record<string, InstanceElement>

const createFlowRecordIndex = (elements: Element[]): RecordsIndex => {
  const recordsIndex: RecordsIndex = {}
  elements
    .filter(isInstanceElement)
    .filter(isInstanceOfTypeSync(CUSTOM_OBJECT))
    .forEach(instance => {
      recordsIndex[apiNameSync(instance) ?? ''] = instance
    })
  return recordsIndex
}

const filter: FilterCreator = ({ config }) => ({
  name: 'addParentToRecordTriggeredFlows',
  onFetch: async (elements: Element[]) => {
    if (!config.fetchProfile.isFeatureEnabled('addParentToRecordTriggeredFlows')) {
      return
    }
    const recordsIndex = createFlowRecordIndex(
      await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll()),
    )
    const count: number = elements
      .filter(isInstanceElement)
      .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
      .reduce((acc, instance) => {
        const flowStart = instance.getTypeSync().fields.start.getTypeSync() as ObjectType
        const flowStartObject = flowStart.fields.object
        if (isDefined(flowStartObject)) {
          const parent = recordsIndex[apiNameSync(flowStartObject) ?? '']
          if (isDefined(parent)) {
            addElementParentReference(instance, parent)
            return acc + 1
          }
        }
        return acc
      }, 0)
    log.debug('addParentToRecordTriggeredFlows created %d references in total', count)
  },
})

export default filter
