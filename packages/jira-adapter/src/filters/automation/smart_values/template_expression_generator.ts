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

const FIELD_REGEX = /^([a-zA-Z0-9_ ]+)(?: |$|\.)/

const handleJiraReference = (
  ref: string,
  fieldsByName: Record<string, InstanceElement>,
  fieldsById: Record<string, InstanceElement>,
): TemplatePart => {
  if (fieldsById[ref] !== undefined) {
    const instance = fieldsById[ref]
    return new ReferenceExpression(instance.elemID, instance)
  }

  if (fieldsByName[ref] !== undefined) {
    const instance = fieldsByName[ref]
    return new ReferenceExpression(instance.elemID.createNestedID('name'), instance.value.name)
  }
  return ref
}

// This function receives a string that contains issue references and replaces
// it with salto style templates.
export const stringToTemplate = (
  referenceStr: string,
  fieldsByName: Record<string, InstanceElement>,
  fieldsById: Record<number, InstanceElement>,

): TemplateExpression | string => {
  const possibleIssues = ['issue', 'destinationIssue', 'triggerIssue', '']
  const possibleFieldKeywords = ['fields', '']

  const possiblePrefixes = possibleIssues
    .flatMap(issueKey => possibleFieldKeywords
      .map(fieldKey => [issueKey, fieldKey].filter(key => key !== '').join('.')))
    .filter(prefix => prefix !== '')
    .map(prefix => `${prefix}.`)

  return extractTemplate(
    referenceStr,
    [REFERENCE_MARKER_REGEX],
    expression => {
      if (!expression.startsWith('{{') || !expression.endsWith('}}')) {
        return expression
      }

      const smartValue = expression.slice(2, -2)

      const prefix = possiblePrefixes.find(pref => smartValue.startsWith(pref)) ?? ''

      const jiraReference = smartValue.slice(prefix.length).match(FIELD_REGEX)
      if (jiraReference) {
        const innerRef = jiraReference[1]
        return [
          `{{${prefix}`,
          handleJiraReference(innerRef, fieldsByName, fieldsById),
          `${smartValue.substring(prefix.length + innerRef.length)}}}`,
        ]
      }
      return expression
    },
  )
}
