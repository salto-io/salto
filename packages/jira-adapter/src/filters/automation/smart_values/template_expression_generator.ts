/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  InstanceElement, ReferenceExpression, TemplateExpression, TemplatePart,
} from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'

const REFERENCE_MARKER_REGEX = /(\{\{.+?\}\})/

// E.g abcd - true, a.b.c.d - false
const FIELD_REGEX = /^([a-zA-Z0-9_ ]+)(?: |$|\.)/

const POSSIBLE_PREFIXES = [
  'issue.fields.', 'destinationIssue.fields.', 'triggerIssue.fields.',
  'issue.', 'destinationIssue.', 'triggerIssue.',
  'fields.']

const SMART_VALUE_PREFIX = '{{'
const SMART_VALUE_SUFFIX = '}}'

type GenerateTemplateParams = {
  referenceStr: string
  fieldInstancesByName: Record<string, InstanceElement>
  fieldInstancesById: Record<string, InstanceElement>
}

const handleJiraReference = ({
  referenceStr,
  fieldInstancesByName,
  fieldInstancesById,
}: GenerateTemplateParams): TemplatePart => {
  if (Object.prototype.hasOwnProperty.call(fieldInstancesById, referenceStr)) {
    const instance = fieldInstancesById[referenceStr]
    return new ReferenceExpression(instance.elemID, instance)
  }

  if (Object.prototype.hasOwnProperty.call(fieldInstancesByName, referenceStr)) {
    const instance = fieldInstancesByName[referenceStr]
    return new ReferenceExpression(instance.elemID.createNestedID('name'), instance.value.name)
  }
  return referenceStr
}

/**
 * This function receives a string that contains issue references and replaces
 * it with salto style templates.
 */
export const stringToTemplate = ({
  referenceStr,
  fieldInstancesByName,
  fieldInstancesById,
}: GenerateTemplateParams): TemplateExpression | string => extractTemplate(
  referenceStr,
  [REFERENCE_MARKER_REGEX],
  expression => {
    if (!expression.startsWith(SMART_VALUE_PREFIX) || !expression.endsWith(SMART_VALUE_SUFFIX)) {
      return expression
    }

    const smartValue = expression.slice(SMART_VALUE_PREFIX.length, -SMART_VALUE_SUFFIX.length)

    const prefix = POSSIBLE_PREFIXES.find(pref => smartValue.startsWith(pref)) ?? ''

    const jiraReference = smartValue.slice(prefix.length).match(FIELD_REGEX)
    if (jiraReference) {
      const innerRef = jiraReference[1]
      return [
        `${SMART_VALUE_PREFIX}${prefix}`,
        handleJiraReference({ referenceStr: innerRef, fieldInstancesByName, fieldInstancesById }),
        `${smartValue.substring(prefix.length + innerRef.length)}${SMART_VALUE_SUFFIX}`,
      ]
    }
    return expression
  },
)
