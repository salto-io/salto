/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ChangeValidator, getChangeData, isInstanceElement, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FIELD_TYPE_NAME, IS_LOCKED, SERVICE, WORK_CATEGORY_FIELD } from '../filters/fields/constants'
import { isRelatedToSpecifiedTerms } from '../common/fields'

const { awu } = collections.asynciterable

const PROJECT_TEMPLATE_TO_FIELDS = (): Record<string, string[]> => ({
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
  const map = PROJECT_TEMPLATE_TO_FIELDS()
  return Object.keys(map).find(key => map[key].includes(field)) ?? 'the relevant type'
}

export const lockedFieldsValidator: ChangeValidator = async changes =>
  awu(changes)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => instance.value[IS_LOCKED] === true)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy a locked field',
      detailedMessage: isRelatedToSpecifiedTerms(instance, [SERVICE, WORK_CATEGORY_FIELD])
        ? 'The field is auto-generated by Atlassian. To create or modify it in the target environment, create a first project ' +
          `from a template of ${jsmFieldToTemplateName(instance.elemID.name)}. For more information, see the documentation at: ` +
          'https://help.salto.io/en/articles/9556414-jira-service-management-locked-fields'
        : 'The field is locked and cannot be deployed. Learn more here: https://help.salto.io/en/articles/6933969-the-field-is-locked-and-cannot-be-deployed',
    }))
    .toArray()
