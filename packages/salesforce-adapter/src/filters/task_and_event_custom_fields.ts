/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  Element, Field,
  getChangeData,
  isFieldChange,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, isCustomObjectSync } from './utils'

const log = logger(module)

const isFieldOfTaskOrEvent = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) && [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(parent) ?? '')

const filterCreator: LocalFilterCreator = () => ({
  name: 'taskAndEventCustomFields',
  /**
   * Upon fetch modify the extension of the StaticResource's static file CONTENT field
   * from '.resource' to the correct extension based on the CONTENT_TYPE field
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    elements.forEach(e => log.debug(`Rachum: Found element: ${e.elemID.getFullName()}`))
    const activity = elements
      .filter(co => co.elemID.name === 'Activity')
      .pop() as ObjectType

    log.debug(`Rachum: Found ${activity?.elemID.typeName} object: ${inspectValue(activity)}`)

    elements
      .filter(isCustomObjectSync)
      // TODO: filter with apiNameSync instead of elemID
      .filter(co => [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(co.elemID.name))
      .forEach(co => {
        log.debug(`Rachum: Found ${co.elemID.typeName} object: ${inspectValue(co)}`)
        Object.entries(co.fields).forEach(([fieldName, field]) => {

          if (!fieldName.endsWith('__c')) {
            return
          }

          const activityField = activity?.fields[fieldName.replace(co.elemID.name, 'Activity')]
          if (!activityField) {
            log.warn(`Rachum: Could not find corresponding field in Activity object for ${co.elemID.name}.${fieldName}`)
            return
          }

          field.annotations = {
            apiName: field.annotations.apiName,
            activityField: new ReferenceExpression(activityField.elemID),
          }
          log.warn(`Rachum: Modified ${co.elemID.name}.${fieldName} to point to ${activityField.elemID.name}`)
        })
      })
  },
  preDeploy: async (changes: Change[]): Promise<void> => {
    log.debug(`Rachum: Old changes (${changes.length}): ${inspectValue(changes)}`)

    const taskOrEventChanges = changes
      .filter(isFieldChange)
      .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
      .filter(change => getChangeData(change).name.endsWith('__c'))

    for (const change of taskOrEventChanges) {
      changes.splice(changes.indexOf(change), 1)
    }

    log.debug(`Rachum: New changes (${changes.length}): ${inspectValue(changes)}`)
  }
})

export default filterCreator
