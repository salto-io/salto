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
import { ElemID } from '@salto-io/adapter-api'

export const JIRA = 'jira'
export const ISSUE_TYPE_SCHEMA_NAME = 'IssueTypeScheme'
export const ISSUE_TYPE_NAME = 'IssueType'
export const STATUS_TYPE_NAME = 'Status'
export const STATUS_CATEGORY_TYPE_NAME = 'StatusCategory'
export const PRIORITY_TYPE_NAME = 'Priority'
export const RESOLUTION_TYPE_NAME = 'Resolution'
export const WORKFLOW_TYPE_NAME = 'Workflow'
export const WORKFLOW_RULES_TYPE_NAME = 'WorkflowRules'
export const SECURITY_SCHEME_TYPE = 'SecurityScheme'
export const SECURITY_LEVEL_TYPE = 'SecurityLevel'
export const SECURITY_LEVEL_MEMBER_TYPE = 'IssueSecurityLevelMember'
export const WORKFLOW_SCHEME_TYPE_NAME = 'WorkflowScheme'
export const WORKFLOW_STATUS_TYPE_NAME = 'WorkflowStatus'
export const WORKFLOW_TRANSITION_TYPE_NAME = 'Transition'
export const LEVEL_MEMBER_TYPE_NAME = 'IssueSecurityLevelMember'
export const DASHBOARD_TYPE = 'Dashboard'
export const DASHBOARD_GADGET_TYPE = 'DashboardGadget'
export const DASHBOARD_GADGET_POSITION_TYPE = 'DashboardGadgetPosition'
export const DASHBOARD_GADGET_PROPERTIES_TYPE = 'GadgetProperties'
export const DASHBOARD_GADGET_PROPERTIES_CONFIG_TYPE = 'GadgetConfig'
export const NOTIFICATION_SCHEME_TYPE_NAME = 'NotificationScheme'
export const NOTIFICATION_EVENT_TYPE_NAME = 'NotificationSchemeEvent'
export const PROJECT_TYPE = 'Project'
export const PROJECT_COMPONENT_TYPE = 'ProjectComponent'
export const PROJECT_ROLE_TYPE = 'ProjectRole'
export const AUTOMATION_TYPE = 'Automation'
export const BOARD_TYPE_NAME = 'Board'
export const BOARD_COLUMN_CONFIG_TYPE = 'BoardConfiguration_columnConfig'
export const BOARD_ESTIMATION_TYPE = 'BoardConfiguration_estimation'
export const BOARD_LOCATION_TYPE = 'Board_location'
export const AUTOMATION_PROJECT_TYPE = 'AutomationProject'
export const AUTOMATION_COMPONENT_TYPE = 'AutomationComponent'
export const AUTOMATION_COMPONENT_VALUE_TYPE = 'AutomationComponentValue'
export const AUTOMATION_FIELD = 'AutomationField'
export const AUTOMATION_STATUS = 'AutomationStatus'
export const AUTOMATION_CONDITION = 'AutomationCondition'
export const AUTOMATION_SUBTASK = 'AutomationSubtask'
export const AUTOMATION_ROLE = 'AutomationRole'
export const AUTOMATION_EMAIL_RECIPENT = 'AutomationEmailRecipent'
export const AUTOMATION_CONDITION_CRITERIA = 'AutomationConditionCriteria'
export const AUTOMATION_GROUP = 'AutomationGroup'
export const AUTOMATION_OPERATION = 'AutomationOperation'
export const AUTOMATION_COMPARE_VALUE = 'AutomationCompareValue'
export const AUTOMATION_LABEL_TYPE = 'AutomationLabel'
export const WEBHOOK_TYPE = 'Webhook'
export const FIELD_CONFIGURATION_TYPE_NAME = 'FieldConfiguration'
export const FIELD_CONFIGURATION_ITEM_TYPE_NAME = 'FieldConfigurationItem'
export const GROUP_TYPE_NAME = 'Group'
export const PERMISSIONS = 'Permissions_permissions'
export const PERMISSION_SCHEME_TYPE_NAME = 'PermissionScheme'
export const ACCOUNT_ID_INFO_TYPE = 'AccountIdInfo'
export const ACCOUNT_ID_STRING = 'ACCOUNT_ID'
export const ACCOUNT_IDS_FIELDS_NAMES = ['leadAccountId', 'authorAccountId', 'accountId', 'actorAccountId', 'user', 'FIELD_USER_KEY']
export const JIRA_USERS_PAGE = 'jira/people/search'
export const ISSUE_EVENT_TYPE_NAME = 'IssueEvent'
export const PRIORITY_SCHEME_TYPE_NAME = 'PriorityScheme'
export const SCREEN_SCHEME_TYPE = 'ScreenScheme'
export const ACCOUNT_INFO_TYPE = 'AccountInfo'
export const LICENSE_TYPE = 'License'
export const LICENSED_APPLICATION_TYPE = 'LicensedApplication'
export const ACCOUNT_INFO_ELEM_ID = new ElemID(JIRA, ACCOUNT_INFO_TYPE, 'instance', ElemID.CONFIG_NAME)
export const JIRA_FREE_PLAN = 'FREE'
export const SCRIPT_RUNNER_TYPE = 'ScriptRunner'
export const POST_FUNCTION_CONFIGURATION = 'PostFunctionConfiguration'
export const CONDITION_CONFIGURATION = 'ConditionConfiguration'
export const VALIDATOR_CONFIGURATION = 'ValidatorConfiguration'
export const DIRECTED_LINK_TYPE = 'DirectedLink'
export const ISSUE_LINK_TYPE_NAME = 'IssueLinkType'
export const USERS_TYPE_NAME = 'Users'
export const USERS_INSTANCE_NAME = 'users'
export const MAIL_LIST_TYPE_NAME = 'MailList'
