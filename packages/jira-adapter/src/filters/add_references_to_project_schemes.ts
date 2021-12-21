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
import {
  Element,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
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
  fieldConfigurationScheme?: FieldConfigurationSchemeValue
  projectIds: string[]
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

type SchemeFieldsValues = {
  workflowScheme: ReferenceExpression
  permissionScheme: ReferenceExpression
  notificationScheme: ReferenceExpression
  issueTypeScreenScheme: ReferenceExpression | IssueTypeScreenSchemeValue
  fieldConfigurationScheme: ReferenceExpression | FieldConfigurationSchemeValue | string
}


export const isProjectInstance = (element: InstanceElement): element is ProjectInstance => {
  const isArrayWithSingleReference = (value: unknown): boolean =>
    _.isArray(value)
    && value.length === 1
    && isReferenceExpression(value[0])
  const hasIssueTypeScreenSchemeField = (): boolean => {
    const isIssueTypeScreenSchemeProjects = (value: Value): boolean =>
      _.isString(value.issueTypeScreenScheme?.id)
    const issueTypeScreenSchemeField = element.value.issueTypeScreenScheme
    return _.isArray(issueTypeScreenSchemeField)
        && issueTypeScreenSchemeField.every(isIssueTypeScreenSchemeProjects)
  }
  const hasFieldConfigurationSchemeField = (): boolean => {
    const isFieldConfigurationSchemeProjects = (value: Value): boolean =>
      _.isArray(value.projectIds) && value.projectIds.every(_.isString)
    const fieldConfigurationSchemeField = element.value.fieldConfigurationScheme
    return _.isArray(fieldConfigurationSchemeField)
        && fieldConfigurationSchemeField.every(isFieldConfigurationSchemeProjects)
  }

  return element.elemID.typeName === 'Project'
      && hasIssueTypeScreenSchemeField()
      && hasFieldConfigurationSchemeField()
      && isReferenceExpression(element.value.workflowScheme[0]?.workflowScheme)
      && isArrayWithSingleReference(element.value.permissionScheme)
      && isArrayWithSingleReference(element.value.notificationScheme)
}
const isFieldConfigurationSchemeInstance = (element: InstanceElement)
  : element is FieldConfigurationSchemeInstance =>
  element.elemID.typeName === 'FieldConfigurationScheme' && _.isString(element.value.id)
const isIssueTypeScreenSchemeInstance = (element: InstanceElement)
  : element is IssueTypeScreenSchemeInstance =>
  element.elemID.typeName === 'IssueTypeScreenScheme' && _.isString(element.value.id)

const setReferences = (
  project: ProjectInstance,
  fieldConfigurationSchemeById: _.Dictionary<FieldConfigurationSchemeInstance>,
  issueTypeScreenSchemeById: _.Dictionary<IssueTypeScreenSchemeInstance>
): void => {
  const getFieldConfigurationSchemeValue = (instance: ProjectInstance)
    : ReferenceExpression | FieldConfigurationSchemeValue | string => {
    const fieldConfigurationSchemeProjects = instance.value.fieldConfigurationScheme[0]
    /* When the project uses the default FieldConfigurationScheme, this value doesnt exist */
    if (fieldConfigurationSchemeProjects.fieldConfigurationScheme === undefined) {
      return 'default'
    }
    const schemeId = fieldConfigurationSchemeProjects.fieldConfigurationScheme.id
    const schemeElemId = fieldConfigurationSchemeById[schemeId]?.elemID
    if (schemeElemId === undefined) {
      log.warn('Could not set reference to unknown FieldConfigurationScheme with id %s', schemeId)
      return fieldConfigurationSchemeProjects.fieldConfigurationScheme
    }
    return new ReferenceExpression(schemeElemId)
  }
  const getIssueTypeScreenSchemeValue = (instance: ProjectInstance)
    : ReferenceExpression | IssueTypeScreenSchemeValue => {
    const issueTypeScreenSchemeProjects = instance.value.issueTypeScreenScheme[0]
    const schemeId = issueTypeScreenSchemeProjects.issueTypeScreenScheme.id
    const schemeElemId = issueTypeScreenSchemeById[schemeId]?.elemID
    if (schemeElemId === undefined) {
      log.warn('Could not set reference to unknown IssueTypeScreenScheme with id %s', schemeId)
      return issueTypeScreenSchemeProjects.issueTypeScreenScheme
    }
    return new ReferenceExpression(schemeElemId)
  }

  const fieldsValues: SchemeFieldsValues = {
    workflowScheme: project.value.workflowScheme[0].workflowScheme,
    permissionScheme: project.value.permissionScheme[0],
    notificationScheme: project.value.notificationScheme[0],
    fieldConfigurationScheme: getFieldConfigurationSchemeValue(project),
    issueTypeScreenScheme: getIssueTypeScreenSchemeValue(project),
  }
  Object
    .entries(fieldsValues)
    .forEach(([fieldName, fieldValue]) => { project.value[fieldName] = fieldValue })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
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
      .forEach(project =>
        setReferences(project, fieldConfigurationSchemeById, issueTypeScreenSchemeById))
  },
})

export default filter
