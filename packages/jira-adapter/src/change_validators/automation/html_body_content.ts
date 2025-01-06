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

type HTMLBodyContentComponentValue = {
  mimeType: string
  body: string
}

type AutomationComponent = {
  type: string
  value: HTMLBodyContentComponentValue
}

enum HTMLBodyContentErrorType {
  mimeType = 'mimeType',
  notStaticFile = 'notStaticFile',
}

const HTML_BODY_CONTENT_AUTOMATION_COMPONENT_SCHEME = Joi.object({
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

const isHTMLBodyContentAutomationComponent = createSchemeGuard<AutomationComponent>(
  HTML_BODY_CONTENT_AUTOMATION_COMPONENT_SCHEME,
)

const getComponentErrorTypes = (component: AutomationComponent): HTMLBodyContentErrorType[] | undefined => {
  const errorTypes: HTMLBodyContentErrorType[] = []
  if (isStaticFile(component.value.body) && component.value.mimeType !== 'text/html') {
    errorTypes.push(HTMLBodyContentErrorType.mimeType)
  }
  if (component.value.mimeType === 'text/html' && !isStaticFile(component.value.body)) {
    errorTypes.push(HTMLBodyContentErrorType.notStaticFile)
  }
  if (errorTypes.length > 0) {
    return errorTypes
  }
  return []
}

const getErrorTypeFromEmailConfig = (
  instance: InstanceElement,
): { elemID: ElemID; errorTypes: HTMLBodyContentErrorType[] }[] | undefined => {
  const elemIDWithErrorTypes: { elemID: ElemID; errorTypes: HTMLBodyContentErrorType[] }[] = []
  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (isHTMLBodyContentAutomationComponent(value)) {
        const componentErrors = getComponentErrorTypes(value)
        if (componentErrors) {
          elemIDWithErrorTypes.push({ elemID: path, errorTypes: componentErrors })
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return elemIDWithErrorTypes.length > 0 ? elemIDWithErrorTypes : []
}

const errorMessageMap = {
  [HTMLBodyContentErrorType.mimeType]: (componentElemID: ElemID) => ({
    elemID: componentElemID,
    severity: 'Error' as SeverityLevel,
    message: 'A mimeType of an automation action is incorrect.',
    detailedMessage: `The action in component: ${componentElemID.getFullName()} has an invalid mimeType. To resolve this, change the mimeType to 'text/html'.`,
  }),
  [HTMLBodyContentErrorType.notStaticFile]: (componentElemID: ElemID) => ({
    elemID: componentElemID,
    severity: 'Error' as SeverityLevel,
    message: 'A content of an automation action is not valid.',
    detailedMessage: `The body content of this action component: ${componentElemID.getFullName()} is invalid. It appears that this component with mimeType "text/html" was modified to an unexpected body content type. To resolve this, revert the file to its original static file format.`,
  }),
}

export const htmlBodyContentValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .map(getErrorTypeFromEmailConfig)
    .filter(isDefined)
    .flat()
    .flatMap(componentElemIDWithErrorTypes =>
      componentElemIDWithErrorTypes.errorTypes.map(errorType => {
        const errorMessageCreator = errorMessageMap[errorType]
        return errorMessageCreator(componentElemIDWithErrorTypes.elemID)
      }),
    )
