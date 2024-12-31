/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isStaticFile,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../../constants'

const { makeArray } = collections.array
const { isDefined } = values

type OutgoingEmailComponentValue = {
  mimeType: string
  body: string
}

type AutomationComponent = {
  type: string
  value: OutgoingEmailComponentValue
  elemID: ElemID
}

enum OutgoingEmailErrorType {
  mimeType = 'mimeType',
  notStaticFile = 'notStaticFile',
}

const AUTOMATION_COMPONENT_SCHEME = Joi.object({
  type: Joi.string().required(),
  value: Joi.object({
    mimeType: Joi.string().required(),
    body: Joi.any().required(),
  }).unknown(true),
})
  .unknown(true)
  .required()

const isAutomationComponent = createSchemeGuard<AutomationComponent>(AUTOMATION_COMPONENT_SCHEME)

const isValidEmailConfig = (
  component: AutomationComponent,
  componentElemID: ElemID,
): { elemID: ElemID; errorTypes: OutgoingEmailErrorType[] } | undefined => {
  const errorTypes: OutgoingEmailErrorType[] = []
  if (component.type === 'jira.issue.outgoing.email') {
    if (component.value.mimeType !== 'text/html') {
      errorTypes.push(OutgoingEmailErrorType.mimeType)
    }
    if (!isStaticFile(component.value.body)) {
      errorTypes.push(OutgoingEmailErrorType.notStaticFile)
    }
  }
  if (errorTypes.length > 0) {
    return { elemID: componentElemID, errorTypes }
  }
  return undefined
}

const getErrorTypeFromEmailConfig = (
  instance: InstanceElement,
): { elemID: ElemID; errorTypes: OutgoingEmailErrorType[] }[] | undefined => {
  if (instance.value.components !== undefined) {
    const componentsElemID = instance.elemID.createNestedID('components')
    return makeArray(instance.value.components)
      .filter(isAutomationComponent)
      .map((component, index) => {
        const componentElemID = componentsElemID.createNestedID(index.toString())
        return isValidEmailConfig(component, componentElemID)
      })
      .filter(isDefined)
      .flat()
  }
  return undefined
}

export const outgoingEmailActionContentValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .map(instance => {
      const errors = getErrorTypeFromEmailConfig(instance)
      if (errors) {
        return errors
          .map(({ elemID: componentElemID, errorTypes }) =>
            errorTypes
              .map(errorType => {
                switch (errorType) {
                  case OutgoingEmailErrorType.mimeType:
                    return {
                      elemID: instance.elemID,
                      severity: 'Error' as SeverityLevel,
                      message: 'A mimeType of an outgoing email automation action is incorrect.',
                      detailedMessage: `The outgoing email action of this component: ${componentElemID.getFullName()} has an invalid mimeType. To resolve it, change its mimeType to 'text/html'.`,
                    }
                  case OutgoingEmailErrorType.notStaticFile:
                    return {
                      elemID: instance.elemID,
                      severity: 'Error' as SeverityLevel,
                      message: 'A content of an outgoing email automation action is not valid.',
                      detailedMessage: `The outgoing email action of this component: ${componentElemID.getFullName()} has an invalid content.`,
                    }
                  default:
                    return undefined
                }
              })
              .filter(isDefined),
          )
          .flat()
      }
      return undefined
    })
    .filter(isDefined)
    .flat()
