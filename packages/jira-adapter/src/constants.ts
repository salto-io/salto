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
import { ElemID } from '@salto-io/adapter-api'

export const JIRA = 'jira'
export const ISSUE_TYPE_SCHEMA_NAME = 'IssueTypeScheme'
export const ISSUE_TYPE_NAME = 'IssueType'
export const STATUS_TYPE_NAME = 'Status'
export const STATUS_CATEGORY_TYPE_NAME = 'StatusCategory'
export const PRIORITY_TYPE_NAME = 'Priority'
export const RESOLUTION_TYPE_NAME = 'Resolution'
export const WORKFLOW_TYPE_NAME = 'Workflow'
export const WORKFLOW_CONFIGURATION_TYPE = 'WorkflowConfiguration'
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
export const PROJECT_TYPE_TYPE_NAME = 'ProjectType'
export const PROJECTS_FIELD = 'projects'
export const PROJECT_COMPONENT_TYPE = 'ProjectComponent'
export const JIRA_SERVICE_DESK_FIELD = 'Jira Service Desk'
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
export const PERMISSIONS = 'Permissions'
export const PERMISSION_SCHEME_TYPE_NAME = 'PermissionScheme'
export const ACCOUNT_ID_INFO_TYPE = 'AccountIdInfo'
export const ACCOUNT_ID_STRING = 'ACCOUNT_ID'
export const ACCOUNT_ID_FIELDS_NAMES = [
  'leadAccountId',
  'authorAccountId',
  'accountId',
  'actorAccountId',
  'user',
  'FIELD_USER_KEY',
]
export const JIRA_USERS_PAGE = 'jira/people/search'
export const ISSUE_EVENT_TYPE_NAME = 'IssueEvent'
export const PRIORITY_SCHEME_TYPE_NAME = 'PriorityScheme'
export const SCREEN_SCHEME_TYPE = 'ScreenScheme'
export const ISSUE_TYPE_SCREEN_SCHEME_TYPE = 'IssueTypeScreenScheme'
export const SCREEN_TYPE_NAME = 'Screen'
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
export const FILTER_TYPE_NAME = 'Filter'
export const SCRIPT_RUNNER_API_DEFINITIONS = 'scriptRunnerApiDefinitions'
export const JSM_DUCKTYPE_API_DEFINITIONS = 'jsmApiDefinitions'
export const SCRIPT_RUNNER_LISTENER_TYPE = 'ScriptRunnerListener'
export const SCRIPT_FRAGMENT_TYPE = 'ScriptFragment'
export const SCHEDULED_JOB_TYPE = 'ScheduledJob'
export const BEHAVIOR_TYPE = 'Behavior'
export const ESCALATION_SERVICE_TYPE = 'EscalationService'
export const SCRIPTED_FIELD_TYPE = 'ScriptedField'
export const SCRIPT_RUNNER_SETTINGS_TYPE = 'ScriptRunnerSettings'
export const SCRIPT_RUNNER_TYPES = [
  SCRIPT_RUNNER_LISTENER_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCHEDULED_JOB_TYPE,
  BEHAVIOR_TYPE,
  ESCALATION_SERVICE_TYPE,
  SCRIPTED_FIELD_TYPE,
]
export const ISSUE_LAYOUT_TYPE = 'IssueLayout'
export const SERVICE_DESK = 'service_desk'
export const SOFTWARE_FIELD = 'software'
export const FETCH_CONFIG = 'fetch'
export const QUEUE_TYPE = 'Queue'
export const REQUEST_TYPE_NAME = 'RequestType'
export const PORTAL_GROUP_TYPE = 'PortalGroup'
export const CALENDAR_TYPE = 'Calendar'
export const CUSTOMER_PERMISSIONS_TYPE = 'CustomerPermissions'
export const PORTAL_SETTINGS_TYPE_NAME = 'PortalSettings'
export const SLA_TYPE_NAME = 'SLA'
export const ISSUE_VIEW_TYPE = 'IssueView'
export const REQUEST_FORM_TYPE = 'RequestForm'
export const FORM_TYPE = 'Form'
export const OBJECT_SCHEMA_TYPE = 'ObjectSchema'
export const OBJECT_SCHEMA_STATUS_TYPE = 'ObjectSchemaStatus'
export const OBJECT_TYPE_TYPE = 'ObjectType'
export const OBJECT_TYPE_ATTRIBUTE_TYPE = 'ObjectTypeAttribute'
export const OBJECT_TYPE_ORDER_TYPE = 'ObjectTypeOrder'
export const OBJECT_SCHMEA_REFERENCE_TYPE_TYPE = 'ObjectSchemaReferenceType'
export const OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE = 'ObjectSchemaDefaultReferenceType'
export const OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE = 'ObjectTypeLabelAttribute'
export const OBJECT_TYPE_ICON_TYPE = 'ObjectTypeIcon'
export const DELETE_LINK_TYPES = 'DeleteLinkTypes'
export const APPLICATION_PROPERTY_TYPE = 'ApplicationProperty'
export const FIELD_TYPE = 'Field'
export const FIELD_CONFIGURATION_SCHEME_TYPE = 'FieldConfigurationScheme'
export const FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH = 255
export const FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH = 1000
export const AUTOMATION_RETRY_PERIODS = [0, 1000 * 60, 1000 * 60 * 5] // 0, 1 minute, 5 minutes, increasing exponentially
// almost constant functions
export const fetchFailedWarnings = (name: string): string =>
  `Salto could not access the ${name} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`
