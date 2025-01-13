/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, Element, getChangeData, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { isWorkflowV1Instance, WorkflowV1Instance } from './types'
import { RESOLUTION_KEY_PATTERN } from '../../references/workflow_properties'

const { awu } = collections.asynciterable

const log = logger(module)

const splitResolutionProperties = (instance: WorkflowV1Instance): void => {
  Object.values(instance.value.transitions)
    .filter(transition => transition.properties !== undefined)
    ?.forEach(transition => {
      transition.properties = _.mapValues(transition.properties, (value, key) =>
        new RegExp(RESOLUTION_KEY_PATTERN).test(key) ? value.split(',') : value,
      )
    })
}

/**
 * This filter is to transform the jira.field.resolution property from a string
 * of 'id1,id2,id3' to a list [id1, id2, id3] so we can convert it to references later
 */
const filter: FilterCreator = () => ({
  name: 'resolutionPropertyFilter',
  onFetch: async (elements: Element[]) => {
    elements.filter(isInstanceElement).filter(isWorkflowV1Instance).forEach(splitResolutionProperties)
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter((change): change is Change<WorkflowV1Instance> => isWorkflowV1Instance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowV1Instance>>(change, async instance => {
          Object.values(instance.value.transitions)
            .filter(transition => _.isPlainObject(transition.properties))
            ?.forEach(transition => {
              transition.properties = _.mapValues(transition.properties, (value, key) => {
                if (!new RegExp(RESOLUTION_KEY_PATTERN).test(key)) {
                  return value
                }
                if (!Array.isArray(value)) {
                  log.warn(
                    `Transition resolution property in instance ${instance.elemID.getFullName()} is not an array: ${safeJsonStringify(value)}`,
                  )
                  return value
                }
                return value.join(',')
              })
            })
          return instance
        })
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter((change): change is Change<WorkflowV1Instance> => isWorkflowV1Instance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowV1Instance>>(change, instance => {
          splitResolutionProperties(instance)
          return instance
        })
      })
  },
})

export default filter
