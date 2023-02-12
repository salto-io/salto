/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, ModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import Joi from 'joi'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { getRelevantChanges, isSameStatusMigration, StatusMigration } from './workflow_scheme_migration'
import { ISSUE_TYPE_NAME, STATUS_TYPE_NAME } from '../constants'

const { isDefined } = values

const statusMigrationSchema = Joi.object({
  issueTypeId: Joi.required(),
  statusId: Joi.required(),
  newStatusId: Joi.required(),
})

const validateStatusMigration = (statusMigration: StatusMigration): boolean =>
  statusMigrationSchema.validate(statusMigration).error === undefined
  && statusMigration.issueTypeId instanceof ReferenceExpression
  && statusMigration.issueTypeId.elemID.typeName === ISSUE_TYPE_NAME
  && statusMigration.statusId instanceof ReferenceExpression
  && statusMigration.statusId.elemID.typeName === STATUS_TYPE_NAME
  && statusMigration.newStatusId instanceof ReferenceExpression
  && statusMigration.newStatusId.elemID.typeName === STATUS_TYPE_NAME

const getRepeatingItem = (statusMigrations: StatusMigration[]): StatusMigration | undefined =>
  statusMigrations.find((item, index, arr) => arr.findIndex(i => isSameStatusMigration(i, item)) !== index)

const generateStatusMigrationRepeatingItemError = (
  change: ModificationChange<InstanceElement>,
  repeatingItem: StatusMigration,
): ChangeError =>
  ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: 'Invalid statusMigration',
    detailedMessage: `The provided statusMigration is invalid. Issue type ${repeatingItem.issueTypeId.elemID.name} and status ${repeatingItem.statusId.elemID.name} appear more than once. Please make sure it's well formatted and includes all required issue types and statuses. Learn more: https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes`,
  })

const generateStatusMigrationInvalidError = (change: ModificationChange<InstanceElement>): ChangeError => ({
  elemID: getChangeData(change).elemID,
  severity: 'Error',
  message: 'Invalid statusMigration',
  detailedMessage: "The provided statusMigration is invalid. One of the objects is not formatted properly, with an issue type, status and new status. Please make sure it's well formatted and includes all required issue types and statuses. Learn more: https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes",
})

const statusMigrationHasInvalidItem = (change: ModificationChange<InstanceElement>): boolean => {
  const instance = getChangeData(change)
  const { statusMigrations } = instance.value
  if (statusMigrations === undefined) {
    return false
  }
  if (!Array.isArray(statusMigrations)) {
    return true
  }
  return statusMigrations.some(item => !validateStatusMigration(item))
}

/**
 * Validates status migration fields in workflowSchemes.
 */
export const statusMigrationChangeValidator: ChangeValidator = async changes => {
  const relevantChanges = getRelevantChanges(changes)
  const invalidItemErrors = _.remove(relevantChanges, statusMigrationHasInvalidItem)
    .map(generateStatusMigrationInvalidError)
  const repeatingItemErrors = relevantChanges.map(change => {
    if (getChangeData(change).value.statusMigrations === undefined) {
      return undefined
    }
    const repeatingItem = getRepeatingItem(getChangeData(change).value.statusMigrations)
    if (repeatingItem === undefined) {
      return undefined
    }
    return generateStatusMigrationRepeatingItemError(change, repeatingItem)
  }).filter(isDefined)
  return [...invalidItemErrors, ...repeatingItemErrors]
}
