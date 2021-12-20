/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const log = logger(module)


type FieldConfigurationSchemeValue = {
  id: string
}

type FieldConfigurationSchemeInstance = InstanceElement & {
  value: InstanceElement['value'] & FieldConfigurationSchemeValue
}

type FieldConfigurationSchemeProjects = {
    fieldConfigurationScheme: FieldConfigurationSchemeValue
}

type IssueTypeScreenSchemeValue = {
  id: string
}

type IssueTypeScreenSchemeInstance = InstanceElement & {
  value: InstanceElement['value'] & IssueTypeScreenSchemeValue
}

type IssueTypeScreenSchemeProjects = {
  issueTypeScreenScheme: IssueTypeScreenSchemeValue
}

export type ProjectInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    workflowScheme: {workflowScheme: ReferenceExpression}[]
    permissionScheme: ReferenceExpression[]
    notificationScheme: ReferenceExpression[]
    fieldConfigurationScheme: FieldConfigurationSchemeProjects[]
    issueTypeScreenScheme: IssueTypeScreenSchemeProjects[]
  }
}

type SchemeReferences = {
  workflowScheme: ReferenceExpression
  permissionScheme: ReferenceExpression
  notificationScheme: ReferenceExpression
  issueTypeScreenScheme: ReferenceExpression | IssueTypeScreenSchemeValue
  fieldConfigurationScheme: ReferenceExpression | FieldConfigurationSchemeValue
}


export const isProjectInstance = (element: InstanceElement): element is ProjectInstance => {
  const isArrayWithSingleReference = (value: unknown): boolean =>
    _.isArray(value)
    && value.length === 1
    && value[0] instanceof ReferenceExpression
  const hasIssueTypeScreenSchemeField = (): boolean => {
    const isIssueTypeScreenSchemeProjects = (value: Value): boolean =>
      _.isString(value.issueTypeScreenScheme?.id)
    const issueTypeScreenSchemeField = element.value.issueTypeScreenScheme
    return _.isArray(issueTypeScreenSchemeField)
        && issueTypeScreenSchemeField.every(isIssueTypeScreenSchemeProjects)
  }
  const hasFieldConfigurationSchemeField = (): boolean => {
    const isFieldConfigurationSchemeProjects = (value: Value): boolean =>
      _.isString(value.fieldConfigurationScheme?.id)
    const fieldConfigurationSchemeField = element.value.fieldConfigurationScheme
    return _.isArray(fieldConfigurationSchemeField)
        && fieldConfigurationSchemeField.every(isFieldConfigurationSchemeProjects)
  }

  return element.elemID.typeName === 'Project'
      && hasIssueTypeScreenSchemeField()
      && hasFieldConfigurationSchemeField()
      && element.value.workflowScheme[0]?.workflowScheme instanceof ReferenceExpression
      && isArrayWithSingleReference(element.value.permissionScheme)
      && isArrayWithSingleReference(element.value.notificationScheme)
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const isFieldConfigurationSchemeInstance = (element: InstanceElement)
      : element is FieldConfigurationSchemeInstance =>
      element.elemID.typeName === 'FieldConfigurationScheme' && _.isString(element.value.id)
    const isIssueTypeScreenSchemeInstance = (element: InstanceElement)
      : element is IssueTypeScreenSchemeInstance =>
      element.elemID.typeName === 'IssueTypeScreenScheme' && _.isString(element.value.id)

    const instances = elements.filter(isInstanceElement)
    const fieldConfigurationSchemeById = _.keyBy(
      instances.filter(isFieldConfigurationSchemeInstance),
      e => e.value.id
    )
    const issueTypeScreenSchemeById = _.keyBy(
      instances.filter(isIssueTypeScreenSchemeInstance),
      e => e.value.id
    )
    instances
      .filter(isProjectInstance)
      .forEach(project => {
        const getFieldConfigurationValue = ()
          : ReferenceExpression | FieldConfigurationSchemeValue => {
          const schemeId = project.value.fieldConfigurationScheme[0].fieldConfigurationScheme.id
          const schemeElemId = fieldConfigurationSchemeById[schemeId]?.elemID
          if (schemeElemId === undefined) {
            log.warn('Could not set reference to unknown FieldConfigurationScheme with id %s', schemeId)
            return project.value.fieldConfigurationScheme[0].fieldConfigurationScheme
          }
          return new ReferenceExpression(schemeElemId)
        }
        const getIssueTypeScreenSchemeValue = ()
          : ReferenceExpression | IssueTypeScreenSchemeValue => {
          const schemeId = project.value.issueTypeScreenScheme[0].issueTypeScreenScheme.id
          const schemeElemId = issueTypeScreenSchemeById[schemeId]?.elemID
          if (schemeElemId === undefined) {
            log.warn('Could not set reference to unknown IssueTypeScreenScheme with id %s', schemeId)
            return project.value.issueTypeScreenScheme[0].issueTypeScreenScheme
          }
          return new ReferenceExpression(schemeElemId)
        }

        const fieldReferences: SchemeReferences = {
          workflowScheme: project.value.workflowScheme[0].workflowScheme,
          permissionScheme: project.value.permissionScheme[0],
          notificationScheme: project.value.notificationScheme[0],
          fieldConfigurationScheme: getFieldConfigurationValue(),
          issueTypeScreenScheme: getIssueTypeScreenSchemeValue(),
        }
        Object
          .entries(fieldReferences)
          .forEach(([fieldName, reference]) => { project.value[fieldName] = reference })
      })
  },
})

export default filter
