/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  isObjectType, Field, Values, TypeElement, isType, BuiltinTypes, ElemID, Element,
  CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS, TypeMap,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  CUSTOM_FIELD, CUSTOM_OBJECT, FIELD_TYPE_NAME_VALUES, SALESFORCE, WORKFLOW_METADATA_TYPE,
  LEAD_CONVERT_SETTINGS_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE,
} from '../constants'
import { id } from './utils'
import {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_FLOW_ACTIONS_FIELD,
  WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD, WORKFLOW_OUTBOUND_MESSAGES_FIELD, WORKFLOW_TASKS_FIELD,
} from './workflow'

const log = logger(module)

interface MissingField {
  name: string
  type: TypeElement | ElemID
  annotations?: Values
  isList?: boolean
}

const allMissingFields: {id: ElemID; fields: MissingField[]}[] = [
  {
    id: new ElemID(SALESFORCE, 'FilterItem'),
    fields: [
      {
        name: 'operation',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual', 'greaterOrEqual',
            'contains', 'notContain', 'startsWith', 'includes', 'excludes', 'within',
          ],
          [CORE_ANNOTATIONS.RESTRICTION]: {
            [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          },
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, LEAD_CONVERT_SETTINGS_METADATA_TYPE),
    fields: [
      {
        name: 'objectMapping',
        type: new ElemID(SALESFORCE, 'ObjectMapping'),
        isList: true,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'RuleEntry'),
    fields: [
      {
        name: 'assignedToType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['User', 'Queue'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ProfileTabVisibility'),
    fields: [
      {
        name: 'visibility',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['DefaultOff', 'DefaultOn', 'Hidden'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LayoutSection'),
    fields: [
      {
        name: 'style',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'TwoColumnsTopToBottom', 'TwoColumnsLeftToRight', 'OneColumn', 'CustomLinks',
          ],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LayoutItem'),
    fields: [
      {
        name: 'behavior',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'Edit', 'Required', 'Readonly',
          ],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'Profile'),
    fields: [
      {
        name: 'userPermissions',
        type: new ElemID(SALESFORCE, 'ProfileUserPermission'),
        isList: true,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
    fields: [
      {
        name: WORKFLOW_ALERTS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowAlert'),
      },
      {
        name: WORKFLOW_FIELD_UPDATES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowFieldUpdate'),
      },
      {
        name: WORKFLOW_FLOW_ACTIONS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowFlowAction'),
      },
      {
        name: WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowKnowledgePublish'),
      },
      {
        name: WORKFLOW_OUTBOUND_MESSAGES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowOutboundMessage'),
      },
      {
        name: WORKFLOW_TASKS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowTask'),
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowCondition'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['EqualTo', 'NotEqualTo', 'GreaterThan', 'LessThan',
            'GreaterThanOrEqualTo', 'LessThanOrEqualTo', 'StartsWith', 'EndsWith', 'Contains',
            'IsNull', 'WasSet', 'WasSelected', 'WasVisited'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowAssignmentItem'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Add', 'AddAtStart', 'AddItem', 'Assign', 'AssignCount',
            'RemoveAfterFirst', 'RemoveAll', 'RemoveBeforeFirst', 'RemoveFirst', 'RemovePosition',
            'RemoveUncommon', 'Subtract'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowRecordFilter'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['EqualTo', 'NotEqualTo', 'GreaterThan', 'LessThan',
            'GreaterThanOrEqualTo', 'LessThanOrEqualTo', 'StartsWith', 'EndsWith', 'Contains',
            'IsNull'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowDynamicChoiceSet'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Currency', 'Date', 'Number', 'String', 'Boolean', 'Picklist',
            'Multipicklist'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowScreenField'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'String'],
        },
      },
      {
        name: 'fieldType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['DisplayText', 'InputField', 'LargeTextArea', 'PasswordField',
            'RadioButtons', 'DropdownBox', 'MultiSelectCheckboxes', 'MultiSelectPicklist',
            'ComponentInstance', 'ComponentChoice', 'ComponentInput'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowVariable'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Apex', 'Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'Multipicklist', 'Picklist', 'String', 'SObject'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowChoice'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'Number', 'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowConstant'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'Number', 'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowFormula'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowRecordLookup'),
    fields: [
      {
        name: 'sortOrder',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Asc', 'Desc'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowLoop'),
    fields: [
      {
        name: 'iterationOrder',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Asc', 'Desc'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_OBJECT),
    fields: [
      {
        name: 'customSettingsType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['List', 'Hierarchy'],
        },
      },
      {
        name: 'deploymentStatus',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['InDevelopment', 'Deployed'],
        },
      },
      {
        name: 'externalSharingModel',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Private', 'Read', 'ReadWrite', 'ReadWriteTransfer',
            'FullAccess', 'ControlledByParent', 'ControlledByCampaign', 'ControlledByLeadOrContact',
          ],
        },
      },
      {
        name: 'gender',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Masculine', 'Feminine', 'Neuter', 'AnimateMasculine'],
        },
      },
      {
        name: 'sharingModel',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Private', 'Read', 'ReadWrite', 'ReadWriteTransfer',
            'FullAccess', 'ControlledByParent', 'ControlledByCampaign', 'ControlledByLeadOrContact',
          ],
        },
      },
      {
        name: 'startsWith',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Consonant', 'Vowel', 'Special'],
        },
      },
      {
        name: 'visibility',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Public', 'Protected', 'PackageProtected'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_FIELD),
    fields: [
      {
        name: 'type',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: FIELD_TYPE_NAME_VALUES,
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ListView'),
    fields: [
      {
        name: 'filterScope',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Everything', 'Mine', 'MineAndMyGroups', 'Queue', 'Delegated',
            'MyTerritory', 'MyTeamTerritory', 'Team'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ListViewFilter'),
    fields: [
      {
        name: 'operation',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['equals', 'notEqual', 'lessThan', 'greaterThan',
            'lessOrEqual', 'greaterOrEqual', 'contains', 'notContain', 'startsWith', 'includes',
            'excludes', 'within'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'WebLink'),
    fields: [
      {
        name: 'displayType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['link', 'button', 'massActionButton'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'StandardValue'),
    fields: [
      {
        name: 'forecastCategory',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Omitted', 'Pipeline', 'BestCase', 'Forecast', 'Closed'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE),
    fields: [
      {
        name: 'gender',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'Masculine', 'Feminine', 'Neuter', 'AnimateMasculine', 'ClassI', 'ClassIII', 'ClassV',
            'ClassVII', 'ClassIX', 'ClassXI', 'ClassXIV', 'ClassXV', 'ClassXVI', 'ClassXVII',
            'ClassXVIII',
          ],
        },
      },
      {
        name: 'startsWith',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Consonant', 'Vowel', 'Special'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'AccountSettings'),
    fields: [
      {
        name: 'enableAccountHistoryTracking',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAccountInsightsInMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContactHistoryTracking',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRelateContactToMultipleAccounts',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ActionsSettings'),
    fields: [
      {
        name: 'enableDefaultQuickActionsOn',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableMdpEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableThirdPartyActions',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'AnalyticsSettings'),
    fields: [
      {
        name: 'alwaysGenPreviews',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'analyticsAdoptionMetadata',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canAccessAnalyticsViaAPI',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canAnnotateDashboards',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canEnableLiveMetrics',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canEnableSavedView',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canExploreDataConversationally',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canShareAppsWithCommunities',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canSubscribeDashboardWidgets',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canViewThumbnailAssets',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAnalyticsEncryption',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAnalyticsSharingEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAutoCompleteCombo',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableC360GlobalProfileData',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDashboardComponentSnapshot',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDashboardFlexiTable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDashboardToPDFEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDataBlending',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailReportsToPortalUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFirebirdEditor',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFloatingReportHeaders',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInsights',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLightningReportBuilder',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLotusNotesImages',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableMassEnableReportBuilder',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNewChartsEngine',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNullDimension',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePowerInsights',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableQueryLiveConnectors',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRemoveFooterForRepDisplay',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRemoveFooterFromRepExp',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableReportFieldToFieldPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableReportNotificationsEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableReportUniqueRowCountPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1AnalyticsEclairEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSFXJoinedReportsEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSmartDataDiscovery',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUseOldChartsLookAndFeel',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableWaveRecordNavigation',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableWaveTrendedDatasetCleanup',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'inheritSharingForNonOpptyObjects',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'inheritSharingForOpptyObject',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'replaceBlankMeasuresWithNulls',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'turnOnTimeZones',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ApexSettings'),
    fields: [
      {
        name: 'enableAggregateCodeCoverageOnly',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApexAccessRightsPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApexApprovalLockUnlock',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApexCtrlImplicitWithSharingPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApexPropertyGetterPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuraApexCtrlAuthUserAccessCheckPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuraApexCtrlGuestUserAccessCheckPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCompileOnDeploy',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDisableParallelApexTesting',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDoNotEmailDebugLog',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableGaplessTestAutoNum',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableMngdCtrlActionAccessPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNonCertifiedApexMdCrud',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSecureNoArgConstructorPref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'AppExperienceSettings'),
    fields: [
      {
        name: 'doesHideAllAppsInAppLauncher',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'CampaignSettings'),
    fields: [
      {
        name: 'enableAutoCampInfluenceDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableB2bmaCampaignInfluence2',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCampaignHistoryTrackEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCampaignInfluence2',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCampaignMemberTWCF',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSuppressNoValueCI2',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'CaseClassificationSettings'),
    fields: [
      {
        name: 'reRunAttributeBasedRules',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'runAssignmentRules',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'CaseSettings'),
    fields: [
      {
        name: 'caseAutoProcUser',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'caseFeedReadUnreadLtng',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'caseMergeinLightning',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'defaultCaseFeedLayoutOn',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailContactOnCasePost',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEscalateQfiToCaseInternal',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEscalateQfiToCaseNetworks',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableExtNetworksCaseFeedEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNewEmailDefaultTemplate',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'escalateCaseBefore',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'genericMessageEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'keepCaseMergeRecords',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'predictiveSupportEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'visibleInCssCheckbox',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ChatterSettings'),
    fields: [
      {
        name: 'allowChatterGroupArchiving',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'allowRecordsInChatterGroup',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'allowSharingInChatterGroup',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApprovalRequest',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCaseFeedRelativeTimestamps',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableChatter',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableChatterEmoticons',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFeedEdit',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFeedPinning',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFeedsDraftPosts',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFeedsRichText',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInviteCsnUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOutOfOfficeEnabledPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRichLinkPreviewsInFeed',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTodayRecsInFeed',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'unlistedGroupsEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'CommunitiesSettings'),
    fields: [
      {
        name: 'canModerateAllFeedPosts',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canModerateInternalFeedPosts',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'embeddedVisualforcePages',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCommunityWorkspaces',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCspContactVisibilityPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCspNotesOnAccConPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEnablePRM',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableExternalAccHierPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableGuestRecordReassignOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInviteChatterGuestEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNetPortalUserReportOpts',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNetworksEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOotbProfExtUserOpsEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePowerCustomerCaseStatus',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePRMAccRelPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRelaxPartnerAccountFieldPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUnsupportedBrowserModalPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUsernameUniqForOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ConnectedAppSettings'),
    fields: [
      {
        name: 'enableAdminApprovedAppsOnly',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAdminApprovedAppsOnlyForExternalUser',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSkipUserProvisioningWizardWelcomePage',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ContentSettings'),
    fields: [
      {
        name: 'enableChatterFileLink',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCMSC2CConnections',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContent',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentAutoAssign',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentDistForPortalUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentDistPwOptionsBit1',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentDistPwOptionsBit2',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentDistribution',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentSupportMultiLanguage',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContentWorkspaceAccess',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDeleteFileInContentPacks',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFileShareSetByRecord',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFilesUsrShareNetRestricted',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableJPGPreviews',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLibraryManagedFiles',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableShowChatterFilesInContent',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSiteGuestUserToUploadFiles',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUploadFilesOnAttachments',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'skipContentAssetTriggers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'skipContentAssetTriggersOnDeploy',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'CurrencySettings'),
    fields: [
      {
        name: 'enableCurrencyEffectiveDates',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCurrencySymbolWithMultiCurrency',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isMultiCurrencyActivationAllowed',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isParenCurrencyConvDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'DataDotComSettings'),
    fields: [
      {
        name: 'enableAccountExportButtonOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAccountImportButtonOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAllowDupeContactFromLead',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAllowDupeLeadFromContact',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCleanUpgradeRequested',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContactExportButtonOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContactImportButtonOff',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'DeploymentSettings'),
    fields: [
      {
        name: 'doesSkipAsyncApexValidation',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'DevHubSettings'),
    fields: [
      {
        name: 'enablePackaging2',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableScratchOrgManagementPref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EACSettings'),
    fields: [
      {
        name: 'enableActivityCapture',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableActivityMetrics',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableActivitySyncEngine',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEACForEveryonePref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInboxActivitySharing',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInsightsInTimeline',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInsightsInTimelineEacStd',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'provisionProductivityFeatures',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EmailAdministrationSettings'),
    fields: [
      {
        name: 'enableComplianceBcc',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailConsentManagement',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailSenderIdCompliance',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailSpfCompliance',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailToSalesforce',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailWorkflowApproval',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEnhancedEmailEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHandleBouncedEmails',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHtmlEmail',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableListEmailLogActivities',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableResendBouncedEmails',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRestrictTlsToDomains',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSendThroughGmailPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSendViaExchangePref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSendViaGmailPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSetMatchingEmailsOnBounce',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUseOrgFootersForExtTrans',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'sendEmailsEvenWhenAutomationUpdatesSameRecord',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'sendMassEmailNotification',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'sendTextOnlySystemEmails',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EmailIntegrationSettings'),
    fields: [
      {
        name: 'doesEmailLogAsEmailMessageInOutlook',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesGmailStayConnectedToSalesforce',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableContactAndEventSync',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEmailTrackingInMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEngageForOutlook',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableGmailIntegration',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOutlookIntegration',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableProductivityFeatures',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSupplementalContactInfoInMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLayoutCustomizationAllowed',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'shouldUseTrustedDomainsList',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EmailTemplateSettings'),
    fields: [
      {
        name: 'enableTemplateEnhancedFolderPref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EnhancedNotesSettings'),
    fields: [
      {
        name: 'enableEnhancedNotes',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTasksOnEnhancedNotes',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EncryptionKeySettings'),
    fields: [
      {
        name: 'enableCacheOnlyKeys',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'canOptOutOfDerivationWithBYOK',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableReplayDetection',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'EventSettings'),
    fields: [
      {
        name: 'enableDeleteMonitoringData',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDynamicStreamingChannel',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEventLogWaveIntegration',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLoginForensics',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableStreamingApi',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTerminateOldestSession',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTransactionSecurityPolicies',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApexLimitEvents',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ExperienceBundleSettings'),
    fields: [
      {
        name: 'enableExperienceBundleMetadata',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FieldServiceSettings'),
    fields: [
      {
        name: 'enableWorkOrders',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowSettings'),
    fields: [
      {
        name: 'doesFormulaEnforceDataAccess',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesFormulaGenerateHtmlOutput',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowBREncodedFixEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowDeployAsActiveEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowFieldFilterEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowFormulasFixEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowInterviewSharingEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowNullPreviousValueFix',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowPauseEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFlowUseApexExceptionEmail',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInvocableFlowFixEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLightningRuntimeEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isAccessToInvokedApexRequired',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isApexPluginAccessModifierRespected',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isEnhancedFlowListViewVisible',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isManageFlowRequiredForAutomationCharts',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'IndustriesSettings'),
    fields: [
      {
        name: 'allowMultipleProducersToWorkOnSamePolicy',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAccessToMasterListOfCoverageTypes',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableBlockResourceAvailabilityOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEventManagementOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFSCInsuranceReport',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableManyToManyRelationships',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableMortgageRlaTotalsOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableMultiResourceOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOverbookingOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableReferralScoring',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'InvocableActionSettings'),
    fields: [
      {
        name: 'isPartialSaveAllowed',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LanguageSettings'),
    fields: [
      {
        name: 'enableCanadaIcuFormat',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableICULocaleDateFormat',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLocalNamesForStdObjects',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTranslationWorkbench',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'useLanguageFallback',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LeadConfigSettings'),
    fields: [
      {
        name: 'doesEnableLeadConvertDefaultSubjectBlankTaskCreation',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesHideOpportunityInConvertLeadWindow',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesPreserveLeadStatus',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesSelectNoOpportunityOnConvertLead',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesTrackHistory',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableConversionsOnMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOrgWideMergeAndDelete',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'shouldLeadConvertRequireValidation',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LiveAgentSettings'),
    fields: [
      {
        name: 'enableQuickTextEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LightningExperienceSettings'),
    fields: [
      {
        name: 'enableAccessCheckCrucPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableApiUserLtngOutAccessPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuraCDNPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuraDepAccessChksCRUCPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFeedbackInMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableGoogleSheetsForSfdcEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIE11DeprecationMsgHidden',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIE11LEXCrucPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInAppTooltips',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLEXOnIpadEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLexEndUsersNoSwitching',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNavPersonalizationOptOut',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRemoveThemeBrandBanner',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1BannerPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1BrowserEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSkypeChatEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1DesktopEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1UiLoggingEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSparkAllUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSparkConversationEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTryLightningOptOut',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUseS1AlohaDesktop',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUsersAreLightningOnly',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableWebExEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableWebexAllUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLEXExtensionComponentCustomizationOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLEXExtensionDarkModeOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLEXExtensionLinkGrabberOff',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLEXExtensionOff',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'MobileSettings'),
    fields: [
      {
        name: 'enableImportContactFromDevice',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLightningOnMobile',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNewSalesforceMobileAppForTablet',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOfflineDraftsEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePopulateNameManuallyInToday',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1EncryptedStoragePref2',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableS1OfflinePref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'MyDomainSettings'),
    fields: [
      {
        name: 'canOnlyLoginWithMyDomainUrl',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesApiLoginRequireOrgDomain',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNativeBrowserForAuthOnAndroid',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNativeBrowserForAuthOnIos',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'useStabilizedMyDomainHostnames',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'useStabilizedSandboxMyDomainHostnames',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'NameSettings'),
    fields: [
      {
        name: 'enableFormalName',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'NotificationsSettings'),
    fields: [
      {
        name: 'enableMobileAppPushNotifications',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNotifications',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OmniChannelSettings'),
    fields: [
      {
        name: 'enableOmniAutoLoginPrompt',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOmniSecondaryRoutingPriority',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OpportunitySettings'),
    fields: [
      {
        name: 'customizableProductSchedulesEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesAutoAddSplitOwnerAsOpportunityTeamMember',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOpportunityFieldHistoryTracking',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOpportunityInsightsInMobile',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OrderManagementSettings'),
    fields: [
      {
        name: 'enableB2CIntegration',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableB2CSelfService',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOrderManagement',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OrderSettings'),
    fields: [
      {
        name: 'enableEnhancedCommerceOrders',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OrgSettings'),
    fields: [
      {
        name: 'enableCustomerSuccessPortal',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableExtendedMailMerge',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableManageSelfServiceUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'saveMailMergeDocsAsSalesforceDocs',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PartyDataModelSettings'),
    fields: [
      {
        name: 'enableAutoSelectIndividualOnMerge',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableConsentManagementEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIndividualAutoCreate',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PardotSettings'),
    fields: [
      {
        name: 'enableB2bmaAppEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEngagementHistoryDashboards',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePardotAppV1Enabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePardotEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableProspectActivityDataset',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PardotEinsteinSettings'),
    fields: [
      {
        name: 'enableCampaignInsight',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEngagementScore',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PathAssistantSettings'),
    fields: [
      {
        name: 'canOverrideAutoPathCollapseWithUserPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'pathAssistantForOpportunityEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PicklistSettings'),
    fields: [
      {
        name: 'isPicklistApiNameEditDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PlatformEncryptionSettings'),
    fields: [
      {
        name: 'canEncryptManagedPackageFields',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isUseHighAssuranceKeysRequired',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isMEKForEncryptionRequired',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDeterministEncryption',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEncryptFieldHistory',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEventBusEncryption',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'PrivacySettings'),
    fields: [
      {
        name: 'enableConsentAuditTrail',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableConsentEventStream',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDefaultMetadataValues',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ProductSettings'),
    fields: [
      {
        name: 'enableMySettings',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'QuoteSettings'),
    fields: [
      {
        name: 'enableQuotesWithoutOppEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'RecordPageSettings'),
    fields: [
      {
        name: 'enableActivityRelatedList',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableFullRecordView',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SchemaSettings'),
    fields: [
      {
        name: 'enableAdvancedCMTSecurity',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAdvancedCSSecurity',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableListCustomSettingCreation',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSOSLOnCustomSettings',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SearchSettings'),
    fields: [
      {
        name: 'enableAdvancedSearchInAlohaSidebar',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEinsteinSearchPersonalization',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePersonalTagging',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePublicTagging',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSalesforceGeneratedSynonyms',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSearchTermHistory',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSetupSearch',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSuggestArticlesLinksOnly',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUseDefaultSearchEntity',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SecuritySettings'),
    fields: [
      {
        name: 'canUsersGrantLoginAccess',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAdminLoginAsAnyUser',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuditFieldsInactiveOwner',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAuraSecureEvalPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRequireHttpsConnection',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isTLSv12Required',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isTLSv12RequiredCommunities',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SharingSettings'),
    fields: [
      {
        name: 'enableAccountRoleOptimization',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableAssetSharing',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCommunityUserVisibility',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableExternalSharingModel',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableManagerGroups',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableManualUserRecordSharing',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePartnerSuperUserAccess',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePortalUserCaseSharing',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePortalUserVisibility',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRemoveTMGroupMembership',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableRestrictAccessLookupRecords',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSecureGuestAccess',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableStandardReportVisibility',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTerritoryForecastManager',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SiteSettings'),
    fields: [
      {
        name: 'enableProxyLoginICHeader',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSitesRecordReassignOrgPref',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableTopicsInSites',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SocialProfileSettings'),
    fields: [
      {
        name: 'isFacebookSocialProfilesDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLinkedInSocialProfilesDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isTwitterSocialProfilesDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isYouTubeSocialProfilesDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSocialProfiles',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'SurveySettings'),
    fields: [
      {
        name: 'enableSurveys',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSurveyOwnerCanManageResponse',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'TrailheadSettings'),
    fields: [
      {
        name: 'enableMyTrailheadPref',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'TrialOrgSettings'),
    fields: [
      {
        name: 'enableSampleDataDeleted',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'UserEngagementSettings'),
    fields: [
      {
        name: 'canGovCloudUseAdoptionApps',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'doesScheduledSwitcherRunDaily',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCustomHelpGlobalSection',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowFeedback',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowHelp',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowNewUser',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowSearch',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowSfdcContent',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowShortcut',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowSupport',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHelpMenuShowTrailhead',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIBILOptOutDashboards',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIBILOptOutEvents',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIBILOptOutReports',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableIBILOptOutTasks',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableLexToClassicFeedbackEnable',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOrchestrationInSandbox',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableOrgUserAssistEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableScheduledSwitcher',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableSfdcProductFeedbackSurvey',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableShowSalesforceUserAssist',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isCrucNotificationDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isLEXWelcomeMatDisabled',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isMeetTheAssistantDisabledInClassic',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'isMeetTheAssistantDisabledInLightning',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'optimizerAppEnabled',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'UserInterfaceSettings'),
    fields: [
      {
        name: 'enableAsyncRelatedLists',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableClickjackUserPageHeaderless',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCollapsibleSections',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCollapsibleSidebar',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCustomObjectTruncate',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableCustomSidebarOnAllPages',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableDeleteFieldHistory',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableExternalObjectAsyncRelatedLists',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableHoverDetails',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableInlineEdit',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enablePersonalCanvas',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableQuickCreate',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'UserManagementSettings'),
    fields: [
      {
        name: 'enableContactlessExternalIdentityUsers',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEnhancedPermsetMgmt',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableEnhancedProfileMgmt',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableNewProfileUI',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableUserSelfDeactivate',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableScrambleUserData',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'VoiceSettings'),
    fields: [
      {
        name: 'enableCallDisposition',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceCallList',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceCallRecording',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceCoaching',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceConferencing',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceLocalPresence',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceMail',
        type: BuiltinTypes.BOOLEAN,
      },
      {
        name: 'enableVoiceMailDrop',
        type: BuiltinTypes.BOOLEAN,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'BusinessHoursSettings'),
    fields: [
      {
        name: 'businessHours',
        type: new ElemID(SALESFORCE, 'BusinessHoursEntry'),
        isList: true,
      },
      {
        name: 'holidays',
        type: new ElemID(SALESFORCE, 'Holidays'),
        isList: true,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LeadConvertSettings'),
    fields: [
      {
        name: 'mappingFields',
        type: new ElemID(SALESFORCE, 'mappingFields'),
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'OrgPreferenceSettings'),
    fields: [
      {
        name: 'preferences',
        type: new ElemID(SALESFORCE, 'OrganizationSettingsDetail'),
        isList: true,
      },
    ],
  },
]

export const makeFilter = (
  missingFields: Record<string, MissingField[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap: TypeMap = _(elements)
      .filter(isType)
      .map(t => [id(t), t])
      .fromPairs()
      .value()

    const addMissingField = (elem: Element) => (f: MissingField): Field | undefined => {
      const type = isType(f.type) ? f.type : typeMap[f.type.getFullName()]
      if (type === undefined) {
        log.warn('Failed to find type %s, omitting field %s', (f.type as ElemID).getFullName(), f.name)
        return undefined
      }
      return new Field(elem.elemID, f.name, type, f.annotations)
    }

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = missingFields[id(elem)]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(addMissingField(elem))
          .reject(_.isUndefined)
          .map((f: Field) => [f.name, f])
          .fromPairs()
          .value())
      }
    })
  },
})

export default makeFilter(
  _(allMissingFields)
    .map(missingField => [missingField.id.getFullName(), missingField.fields])
    .fromPairs()
    .value(),
)
