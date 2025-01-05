/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import { createSchemeGuard, WALK_NEXT_STEP, walkOnValue } from '@salto-io/adapter-utils'
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
import { values } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../../constants'

const { isDefined } = values

type OutgoingEmailComponentValue = {
  mimeType: string
  body: string
}

type AutomationComponent = {
  type: string
  value: OutgoingEmailComponentValue
}

enum OutgoingEmailErrorType {
  mimeType = 'mimeType',
  notStaticFile = 'notStaticFile',
}

const OUTGOING_EMAIL_AUTOMATION_COMPONENT_SCHEME = Joi.object({
  type: Joi.string().required(),
  value: Joi.object({
    mimeType: Joi.string().required(),
    body: Joi.any().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isOutgoingEmailAutomationComponent = createSchemeGuard<AutomationComponent>(
  OUTGOING_EMAIL_AUTOMATION_COMPONENT_SCHEME,
)

const getComponentErrorTypes = (component: AutomationComponent): OutgoingEmailErrorType[] | undefined => {
  const errorTypes: OutgoingEmailErrorType[] = []
  if (component.value.mimeType !== 'text/html') {
    errorTypes.push(OutgoingEmailErrorType.mimeType)
  }
  if (!isStaticFile(component.value.body)) {
    errorTypes.push(OutgoingEmailErrorType.notStaticFile)
  }
  if (errorTypes.length > 0) {
    return errorTypes
  }
  return undefined
}

const getErrorTypeFromEmailConfig = (
  instance: InstanceElement,
): { elemID: ElemID; errorTypes: OutgoingEmailErrorType[] }[] | undefined => {
  const result: { elemID: ElemID; errorTypes: OutgoingEmailErrorType[] }[] = []
  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (value.type === 'jira.issue.outgoing.email' && isOutgoingEmailAutomationComponent(value)) {
        const componentErrors = getComponentErrorTypes(value)
        if (componentErrors) {
          result.push({ elemID: path, errorTypes: componentErrors })
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return result.length > 0 ? result : undefined
}

const errorMessageMap = {
  [OutgoingEmailErrorType.mimeType]: (componentElemID: ElemID) => ({
    elemID: componentElemID,
    severity: 'Error' as SeverityLevel,
    message: 'A mimeType of an outgoing email automation action is incorrect.',
    detailedMessage: `The outgoing email action of this component: ${componentElemID.getFullName()} has an invalid mimeType. To resolve it, change its mimeType to 'text/html'.`,
  }),
  [OutgoingEmailErrorType.notStaticFile]: (componentElemID: ElemID) => ({
    elemID: componentElemID,
    severity: 'Error' as SeverityLevel,
    message: 'A content of an outgoing email automation action is not valid.',
    detailedMessage: `The outgoing email action of this component: ${componentElemID.getFullName()} has an invalid body content. To resolve it, change it to its previous content.`,
  }),
}

export const outgoingEmailContentValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .map(getErrorTypeFromEmailConfig)
    .filter(isDefined)
    .flat()
    .map(componentElemIDWithErrorTypes =>
      componentElemIDWithErrorTypes.errorTypes.map(errorType => {
        const errorMessageCreator = errorMessageMap[errorType]
        return errorMessageCreator(componentElemIDWithErrorTypes.elemID)
      }),
    )
    .flat()
