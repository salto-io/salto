/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceElement, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FIELD_TYPE_NAME, IS_LOCKED, SERVICE, WORK_CATEGORY_FIELD } from '../../filters/fields/constants'
import { isRelatedToSpecifiedTerms } from '../../common/fields'

const { awu } = collections.asynciterable

const JSM_FIELD_TYPE_MAP = (): Record<string, string[]> => ({
  'IT Service Management': [
    'Major_incident__major_incident_entity_field_cftype__c@suubbbbuu',
    'Responders__responders_entity_field_cftype__c@uubbbuu',
    'Time_to_close_after_resolution__sd_sla_field__c@ssssuubbuu',
    'Time_to_review_normal_change__sd_sla_field__c@ssssuubbuu', // end of specific fields
    'Affected_services__service_entity_field_cftype__c@suubbbuu',
    'Approvals__sd_approvals__c@uubuu',
    'Request_language__sd_request_language__c@suubbuu',
    'Request_participants__sd_request_participants__c@suubbuu',
    'Satisfaction__sd_request_feedback__c@uubbuu',
    'Satisfaction_date__sd_request_feedback_date__c@suubbbuu',
    'Time_to_first_response__sd_sla_field__c@sssuubbuu',
    'Time_to_resolution__sd_sla_field__c@ssuubbuu',
    'Work_category__work_category_field_cftype__c@suubbbuu',
  ],
  'IT Service Management Essentials': [
    'Time_to_done__sd_sla_field__c@ssuubbuu',
    'Time_to_triage_normal_change__sd_sla_field__c@ssssuubbuu',
  ],
  'HR Service Management': ['Organizations__sd_customer_organizations__c@uubbuu', 'Request_Type__vp_origin__c@suubuu'],
})

const jsmFieldToTemplateName = (field: string): string => {
  const map = JSM_FIELD_TYPE_MAP()
  return Object.keys(map).find(key => map[key].includes(field)) ?? 'the relevant type'
}

export const jsmLockedFieldsValidator: ChangeValidator = async changes =>
  awu(changes)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => instance.value[IS_LOCKED] === true)
    .filter(instance => isRelatedToSpecifiedTerms(instance, [SERVICE, WORK_CATEGORY_FIELD]))
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy a locked field',
      detailedMessage: `The field is Atlassian generated. To create it you must create a first project from a template of ${jsmFieldToTemplateName(instance.elemID.name)}`,
    }))
    .toArray()
