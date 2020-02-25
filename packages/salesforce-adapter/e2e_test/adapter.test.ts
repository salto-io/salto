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
  ObjectType, ElemID, InstanceElement, Field, Value, Element, Values, BuiltinTypes,
  isInstanceElement, ReferenceExpression, CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS, findElement,
  findObjectType, bpCase, TypeElement, isObjectType,
} from '@salto-io/adapter-api'
import { MetadataInfo, RetrieveResult } from 'jsforce'
import { collections } from '@salto-io/lowerdash'
import * as constants from '../src/constants'
import {
  annotationsFileName, customFieldsFileName,
  INSTANCE_TYPE_FIELD, NESTED_INSTANCE_TYPE_NAME,
  standardFieldsFileName,
  transformFieldAnnotations,
} from '../src/filters/custom_objects'
import { STANDARD_VALUE, STANDARD_VALUE_SET } from '../src/filters/standard_value_sets'
import { GLOBAL_VALUE_SET } from '../src/filters/global_value_sets'
import {
  CustomField, CustomObject, FieldPermissions, FilterItem, ObjectPermissions, ProfileInfo,
  TopicsForObjectsInfo,
} from '../src/client/types'
import {
  Types, fromMetadataInfo, metadataType, apiName, formulaTypeName,
} from '../src/transformers/transformer'
import realAdapter from './adapter'
import { findElements } from '../test/utils'
import SalesforceClient, { API_VERSION } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import { fromRetrieveResult, toMetadataPackageZip } from '../src/transformers/xml_transformer'
import {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD, WORKFLOW_TASKS_FIELD,
} from '../src/filters/workflow'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'

const { makeArray } = collections.array
const { FIELD_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE } = constants

const ADMIN = 'Admin'
const STANDARD = 'Standard'

describe('Salesforce adapter E2E with real account', () => {
  let client: SalesforceClient
  let adapter: SalesforceAdapter

  beforeAll(() => {
    ({ adapter, client } = realAdapter())
  })

  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let result: Element[]
  const apiNameAnno = (object: string, field: string): string => [
    object,
    field,
  ].join(constants.API_NAME_SEPERATOR)

  const objectExists = async (type: string, name: string, fields?: string[],
    missingFields?: string[], annotations?: Record<string, Value>):
    Promise<boolean> => {
    const readResult = (await client.readMetadata(type, name)
    )[0] as CustomObject
    if (!readResult || !readResult.fullName) {
      return false
    }
    if (fields || missingFields) {
      const fieldNames = makeArray(readResult.fields).map(rf => rf.fullName)
      if (fields && !fields.every(f => fieldNames.includes(f))) {
        return false
      }
      return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
    }
    if (annotations) {
      const valuesMatch = Object.entries(annotations)
        .every(([annotationName, expectedVal]) =>
          _.isEqual(_.get(readResult, annotationName), expectedVal))
      if (!valuesMatch) {
        return false
      }
    }
    return true
  }

  const findCustomFieldsObject = (elements: Element[], name: string): ObjectType => {
    const customObjects = findElements(elements, name) as ObjectType[]
    return customObjects
      .find(obj => obj.path?.slice(-1)[0] === customFieldsFileName(name)) as ObjectType
  }

  const findStandardFieldsObject = (elements: Element[], name: string): ObjectType => {
    const customObjects = findElements(elements, name) as ObjectType[]
    return customObjects
      .find(obj => obj.path?.slice(-1)[0] === standardFieldsFileName(name)) as ObjectType
  }

  const findAnnotationsObject = (elements: Element[], name: string): ObjectType => {
    const customObjects = findElements(elements, name) as ObjectType[]
    return customObjects
      .find(obj => obj.path?.slice(-1)[0] === annotationsFileName(name)) as ObjectType
  }

  const gvsName = 'TestGlobalValueSet'
  const accountApiName = 'Account'
  const fetchedRollupSummaryFieldName = 'rollupsummary__c'
  const customObjectWithFieldsName = 'TestFields__c'
  const randomString = String(Date.now()).substring(6)

  // Custom field names
  const picklistFieldName = 'Pickle__c'
  const currencyFieldName = 'Alpha__c'
  const autoNumberFieldName = 'Bravo__c'
  const dateFieldName = 'Charlie__c'
  const timeFieldName = 'Delta__c'
  const multiSelectPicklistFieldName = 'Hotel__c'
  const dateTimeFieldName = 'Echo__c'
  const emailFieldName = 'Foxtrot__c'
  const locationFieldName = 'Golf__c'
  const percentFieldName = 'India__c'
  const phoneFieldName = 'Juliett__c'
  const longTextAreaFieldName = 'Kilo__c'
  const richTextAreaFieldName = 'Lima__c'
  const textAreaFieldName = 'Mike__c'
  const encryptedTextFieldName = 'November__c'
  const urlFieldName = 'Oscar__c'
  const numberFieldName = 'Papa__c'
  const textFieldName = 'Sierra__c'
  const checkboxFieldName = 'Tango__c'
  const globalPicklistFieldName = 'Uniform__c'
  const lookupFieldName = `Quebec${randomString}__c`
  const masterDetailFieldName = `Romeo${randomString}__c`
  const formulaFieldName = 'Whiskey__c'

  beforeAll(async () => {
    const verifyObjectsDependentFieldsExist = async (): Promise<void> => {
      await client.upsert('GlobalValueSet', {
        fullName: gvsName,
        masterLabel: gvsName,
        sorted: false,
        description: 'GlobalValueSet that should be fetched in e2e test',
        customValue: [
          {
            fullName: 'Val1',
            default: true,
            label: 'Val1',
          },
          {
            fullName: 'Val2',
            default: false,
            label: 'Val2',
          },
        ],
      } as MetadataInfo)
    }

    const addCustomObjectWithVariousFields = async (): Promise<void> => {
      const objectToAdd = {
        deploymentStatus: 'Deployed',
        fields: [
          {
            fullName: picklistFieldName,
            label: 'Picklist label',
            description: 'Picklist description',
            required: false,
            type: constants.FIELD_TYPE_NAMES.PICKLIST,
            valueSet: {
              restricted: true,
              valueSetDefinition: {
                value: [
                  {
                    default: true,
                    fullName: 'NEW',
                    label: 'NEW',
                    color: '#FF0000',
                  },
                  {
                    default: false,
                    fullName: 'OLD',
                    label: 'OLD',
                    isActive: true,
                  },
                  {
                    default: false,
                    fullName: 'OLDEST',
                    label: 'OLDEST',
                    isActive: false,
                  },
                ],
              },
            },
          },
          {
            defaultValue: 25,
            fullName: currencyFieldName,
            label: 'Currency label',
            description: 'Currency description',
            inlineHelpText: 'Currency help',
            precision: 18,
            required: true,
            scale: 3,
            type: constants.FIELD_TYPE_NAMES.CURRENCY,
          },
          {
            displayFormat: 'ZZZ-{0000}',
            fullName: autoNumberFieldName,
            label: 'Autonumber label',
            description: 'Autonumber description',
            inlineHelpText: 'Autonumber help',
            externalId: true,
            type: constants.FIELD_TYPE_NAMES.AUTONUMBER,
          },
          {
            defaultValue: 'Today() + 7',
            fullName: dateFieldName,
            label: 'Date label',
            description: 'Date description',
            inlineHelpText: 'Date help',
            required: false,
            type: constants.FIELD_TYPE_NAMES.DATE,
          },
          {
            defaultValue: 'TIMENOW() + 5',
            fullName: timeFieldName,
            label: 'Time label',
            description: 'Time description',
            inlineHelpText: 'Time help',
            required: true,
            type: constants.FIELD_TYPE_NAMES.TIME,
          },
          {
            defaultValue: 'NOW() + 7',
            fullName: dateTimeFieldName,
            label: 'DateTime label',
            description: 'DateTime description',
            inlineHelpText: 'DateTime help',
            required: false,
            type: constants.FIELD_TYPE_NAMES.DATETIME,
          },
          {
            fullName: emailFieldName,
            label: 'Email label',
            required: false,
            unique: true,
            externalId: true,
            type: constants.FIELD_TYPE_NAMES.EMAIL,
          },
          {
            displayLocationInDecimal: true,
            fullName: locationFieldName,
            label: 'Location label',
            required: false,
            scale: 2,
            type: constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
          },
          {
            fullName: percentFieldName,
            label: 'Percent label',
            description: 'Percent description',
            precision: 12,
            required: false,
            scale: 3,
            type: constants.FIELD_TYPE_NAMES.PERCENT,
          },
          {
            fullName: phoneFieldName,
            label: 'Phone label',
            inlineHelpText: 'Phone help',
            required: true,
            type: constants.FIELD_TYPE_NAMES.PHONE,
          },
          {
            fullName: longTextAreaFieldName,
            label: 'LongTextArea label',
            length: 32700,
            required: false,
            type: constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
            visibleLines: 5,
          },
          {
            fullName: richTextAreaFieldName,
            label: 'RichTextArea label',
            description: 'RichTextArea description',
            inlineHelpText: 'RichTextArea help',
            length: 32600,
            required: false,
            type: constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
            visibleLines: 32,
          },
          {
            fullName: textAreaFieldName,
            label: 'TextArea label',
            description: 'TextArea description',
            inlineHelpText: 'TextArea help',
            required: false,
            type: constants.FIELD_TYPE_NAMES.TEXTAREA,
          },
          {
            fullName: encryptedTextFieldName,
            label: 'EncryptedText label',
            length: 35,
            maskChar: 'asterisk',
            maskType: 'creditCard',
            required: false,
            type: constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
          },
          {
            fullName: urlFieldName,
            label: 'Url label',
            required: false,
            type: constants.FIELD_TYPE_NAMES.URL,
          },
          {
            defaultValue: 42,
            fullName: numberFieldName,
            label: 'Number label',
            precision: 15,
            required: false,
            scale: 3,
            type: constants.FIELD_TYPE_NAMES.NUMBER,
            unique: true,
          },
          {
            fullName: textFieldName,
            label: 'Text label',
            required: false,
            length: 100,
            caseSensitive: true,
            externalId: true,
            type: constants.FIELD_TYPE_NAMES.TEXT,
            unique: true,
          },
          {
            defaultValue: true,
            fullName: checkboxFieldName,
            label: 'Checkbox label',
            type: constants.FIELD_TYPE_NAMES.CHECKBOX,
          },
          {
            fullName: globalPicklistFieldName,
            label: 'Global Picklist label',
            required: false,
            valueSet: {
              restricted: true,
              valueSetName: gvsName,
            },
            type: constants.FIELD_TYPE_NAMES.PICKLIST,
          },
          {
            fullName: masterDetailFieldName,
            label: 'MasterDetail label',
            referenceTo: [
              'Case',
            ],
            relationshipName: masterDetailFieldName.split(constants.SALESFORCE_CUSTOM_SUFFIX)[0],
            reparentableMasterDetail: true,
            required: false,
            type: constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
            writeRequiresMasterRead: true,
            relationshipOrder: 0,
          },
          {
            formula: '5 > 4',
            fullName: formulaFieldName,
            label: 'Formula Checkbox label',
            businessStatus: 'Hidden',
            securityClassification: 'Restricted',
            formulaTreatBlanksAs: 'BlankAsZero',
            type: constants.FIELD_TYPE_NAMES.CHECKBOX,
          },
        ] as CustomField[],
        fullName: customObjectWithFieldsName,
        label: 'test object with various field types',
        nameField: {
          label: 'Name',
          type: 'Text',
        },
        pluralLabel: 'test object with various field typess',
        sharingModel: 'ControlledByParent',
      }
      const additionalFieldsToAdd = [{
        fullName: `${customObjectWithFieldsName}.${multiSelectPicklistFieldName}`,
        label: 'Multipicklist label',
        required: false,
        type: constants.FIELD_TYPE_NAMES.MULTIPICKLIST,
        valueSet: {
          controllingField: picklistFieldName,
          restricted: false,
          valueSetDefinition: {
            value: [
              {
                default: false,
                fullName: 'RE',
                label: 'RE',
              },
              {
                default: true,
                fullName: 'DO',
                label: 'DO',
              },
            ],
          },
          valueSettings: [
            {
              controllingFieldValue: [
                'NEW',
                'OLD',
              ],
              valueName: 'DO',
            },
            {
              controllingFieldValue: [
                'OLD',
              ],
              valueName: 'RE',
            },
          ],
        },
        visibleLines: 4,
      },
      {
        fullName: `${accountApiName}.${fetchedRollupSummaryFieldName}`,
        label: 'Summary label',
        summarizedField: 'Opportunity.Amount',
        summaryFilterItems: {
          field: 'Opportunity.Amount',
          operation: 'greaterThan',
          value: '1',
        },
        summaryForeignKey: 'Opportunity.AccountId',
        summaryOperation: 'sum',
        type: 'Summary',
      }]
      const lookupField = {
        deleteConstraint: 'Restrict',
        fullName: lookupFieldName,
        label: 'Lookup label',
        referenceTo: ['Opportunity'],
        relationshipName: lookupFieldName.split(constants.SALESFORCE_CUSTOM_SUFFIX)[0],
        required: false,
        type: constants.FIELD_TYPE_NAMES.LOOKUP,
      } as CustomField
      objectToAdd.fields.push(lookupField)
      const lookupFilter = {
        active: true,
        booleanFilter: '1 OR 2',
        errorMessage: 'This is the Error message',
        infoMessage: 'This is the Info message',
        isOptional: false,
        filterItems: [{
          field: 'Opportunity.OwnerId',
          operation: 'equals',
          valueField: '$User.Id',
        },
        {
          field: 'Opportunity.NextStep',
          operation: 'equals',
          value: 'NextStepValue',
        }],
      }
      await verifyObjectsDependentFieldsExist()
      if (await objectExists(constants.CUSTOM_OBJECT, customObjectWithFieldsName)) {
        await client.delete(constants.CUSTOM_OBJECT, customObjectWithFieldsName)
      }
      await client.upsert(constants.CUSTOM_OBJECT, objectToAdd as MetadataInfo)
      await client.upsert(constants.CUSTOM_FIELD, additionalFieldsToAdd as MetadataInfo[])

      // Add the fields permissions
      const objectFieldNames = objectToAdd.fields
        .filter(field => !field.required)
        .filter(field => field.type !== constants.FIELD_TYPE_NAMES.MASTER_DETAIL)
        .map(field => `${customObjectWithFieldsName}.${field.fullName}`)
      const additionalFieldNames = additionalFieldsToAdd
        .filter(field => !field.required)
        .map(f => f.fullName)
      const fieldNames = objectFieldNames.concat(additionalFieldNames)
      await client.update(PROFILE_METADATA_TYPE,
        new ProfileInfo(ADMIN, fieldNames.map(name => ({
          field: name,
          editable: true,
          readable: true,
        }))))

      // update lookup filter
      await client.update(constants.CUSTOM_FIELD,
        Object.assign(lookupField,
          { fullName: `${customObjectWithFieldsName}.${lookupFieldName}`, lookupFilter }))
    }

    const verifyEmailTemplateAndFolderExist = async (): Promise<void> => {
      await client.upsert('EmailFolder', {
        fullName: 'TestEmailFolder',
        name: 'Test Email Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)

      await client.upsert('EmailTemplate', {
        fullName: 'TestEmailFolder/TestEmailTemplate',
        name: 'Test Email Template Name',
        available: true,
        style: 'none',
        subject: 'Test Email Template Subject',
        uiType: 'Aloha',
        encodingKey: 'UTF-8',
        type: 'text',
        description: 'Test Email Template Description',
        content: 'Email Body',
      } as MetadataInfo)
    }

    const verifyReportAndFolderExist = async (): Promise<void> => {
      await client.upsert('ReportFolder', {
        fullName: 'TestReportFolder',
        name: 'Test Report Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)

      await client.upsert('Report', {
        fullName: 'TestReportFolder/TestReport',
        format: 'Summary',
        name: 'Test Report Name',
        reportType: 'Opportunity',
      } as MetadataInfo)
    }

    const verifyDashboardAndFolderExist = async (): Promise<void> => {
      await client.upsert('DashboardFolder', {
        fullName: 'TestDashboardFolder',
        name: 'Test Dashboard Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)

      await client.upsert('Dashboard', {
        fullName: 'TestDashboardFolder/TestDashboard',
        backgroundEndColor: '#FFFFFF',
        backgroundFadeDirection: 'Diagonal',
        backgroundStartColor: '#FFFFFF',
        textColor: '#000000',
        title: 'Test Dashboard Title',
        titleColor: '#000000',
        titleSize: '12',
        leftSection: {
          columnSize: 'Medium',
          components: [],
        },
        rightSection: {
          columnSize: 'Medium',
          components: [],
        },
      } as MetadataInfo)
    }

    const verifyLeadHasValidationRule = async (): Promise<void> => {
      await client.upsert('ValidationRule', {
        fullName: 'Lead.TestValidationRule',
        active: true,
        description: 'ValidationRule that should be fetched in e2e test',
        errorConditionFormula: 'false',
        errorMessage: 'Error Message!',
      } as MetadataInfo)
    }

    const verifyLeadHasBusinessProcess = async (): Promise<void> => {
      await client.upsert('BusinessProcess', {
        fullName: 'Lead.TestBusinessProcess',
        isActive: true,
        description: 'BusinessProcess that should be fetched in e2e test',
        values: [
          {
            fullName: 'Open - Not Contacted',
            default: true,
          },
          {
            fullName: 'Closed - Not Converted',
            default: false,
          },
        ],
      } as MetadataInfo)
    }

    const verifyLeadHasRecordType = async (): Promise<void> => {
      await client.upsert('RecordType', {
        fullName: 'Lead.TestRecordType',
        active: true,
        businessProcess: 'TestBusinessProcess',
        description: 'RecordType that should be fetched in e2e test',
        label: 'E2E Fetch RecordType',
      } as MetadataInfo)
    }

    const verifyLeadHasWebLink = async (): Promise<void> => {
      await client.upsert('WebLink', {
        fullName: 'Lead.TestWebLink',
        availability: 'online',
        description: 'WebLink that should be fetched in e2e test',
        displayType: 'button',
        encodingKey: 'UTF-8',
        hasMenubar: false,
        hasScrollbars: true,
        hasToolbar: false,
        height: 600,
        isResizable: true,
        linkType: 'url',
        masterLabel: 'E2E Fetch WebLink',
        openType: 'newWindow',
        position: 'none',
        protected: false,
        url: '{!Lead.CreatedBy} = "MyName"',
      } as MetadataInfo)
    }

    const verifyLeadHasListView = async (): Promise<void> => {
      await client.upsert('ListView', {
        fullName: 'Lead.TestListView',
        label: 'E2E Fetch ListView',
        filterScope: 'Everything',
        filters: {
          field: 'LEAD.STATUS',
          operation: 'equals',
          value: 'closed',
        },
      } as MetadataInfo)
    }

    const verifyLeadHasFieldSet = async (): Promise<void> => {
      await client.upsert('FieldSet', {
        fullName: 'Lead.TestFieldSet',
        description: 'E2E Fetch FieldSet',
        displayedFields: [
          {
            field: 'State',
            isFieldManaged: false,
            isRequired: false,
          },
          {
            field: 'Status',
            isFieldManaged: false,
            isRequired: false,
          },
        ],
        label: 'E2E Fetch FieldSet',
      } as MetadataInfo)
    }

    const verifyLeadHasCompactLayout = async (): Promise<void> => {
      await client.upsert('CompactLayout', {
        fullName: 'Lead.TestCompactLayout',
        fields: [
          'Address',
          'Company',
        ],
        label: 'E2E Fetch CompactLayout',
      } as MetadataInfo)
    }

    const verifyCustomObjectInnerTypesExist = async (): Promise<void[]> => {
      await verifyLeadHasBusinessProcess() // RecordType depends on BusinessProcess
      return Promise.all([
        verifyLeadHasValidationRule(),
        verifyLeadHasRecordType(),
        verifyLeadHasWebLink(),
        verifyLeadHasListView(),
        verifyLeadHasFieldSet(),
        verifyLeadHasCompactLayout(),
      ])
    }

    const verifyLeadHasWorkflowAlert = async (): Promise<void> => {
      await client.upsert('WorkflowAlert', {
        fullName: 'Lead.TestWorkflowAlert',
        description: 'E2E Fetch WorkflowAlert',
        protected: false,
        recipients: [
          {
            recipient: 'CEO',
            type: 'role',
          },
        ],
        senderType: 'CurrentUser',
        template: 'TestEmailFolder/TestEmailTemplate',
      } as MetadataInfo)
    }

    const verifyLeadHasWorkflowFieldUpdate = async (): Promise<void> => {
      await client.upsert('WorkflowFieldUpdate', {
        fullName: 'Lead.TestWorkflowFieldUpdate',
        name: 'TestWorkflowFieldUpdate',
        description: 'E2E Fetch WorkflowFieldUpdate',
        field: 'Company',
        notifyAssignee: false,
        protected: false,
        operation: 'Null',
      } as MetadataInfo)
    }

    const verifyLeadHasWorkflowTask = async (): Promise<void> => {
      await client.upsert('WorkflowTask', {
        fullName: 'Lead.TestWorkflowTask',
        assignedTo: 'CEO',
        assignedToType: 'role',
        description: 'E2E Fetch WorkflowTask',
        dueDateOffset: 1,
        notifyAssignee: false,
        priority: 'Normal',
        protected: false,
        status: 'Not Started',
        subject: 'TestWorkflowOutboundMessage',
      } as MetadataInfo)
    }

    const verifyLeadHasWorkflowRule = async (): Promise<void> => {
      await client.upsert('WorkflowRule', {
        fullName: 'Lead.TestWorkflowRule',
        actions: [
          {
            name: 'TestWorkflowAlert',
            type: 'Alert',
          },
          {
            name: 'TestWorkflowFieldUpdate',
            type: 'FieldUpdate',
          },
          {
            name: 'TestWorkflowTask',
            type: 'Task',
          },
        ],
        active: false,
        criteriaItems: [
          {
            field: 'Lead.Company',
            operation: 'notEqual',
            value: 'BLA',
          },
        ],
        description: 'E2E Fetch WorkflowRule',
        triggerType: 'onCreateOnly',
        workflowTimeTriggers: [
          {
            actions: [
              {
                name: 'TestWorkflowAlert',
                type: 'Alert',
              },
            ],
            timeLength: '1',
            workflowTimeTriggerUnit: 'Hours',
          },
        ],
      } as MetadataInfo)
    }

    const verifyLeadWorkflowInnerTypesExist = async (): Promise<void> => {
      await Promise.all([
        verifyLeadHasWorkflowAlert(),
        verifyLeadHasWorkflowFieldUpdate(),
        verifyLeadHasWorkflowTask(),
      ])
      return verifyLeadHasWorkflowRule() // WorkflowRule depends on Alert, FieldUpdate & Task
    }

    const verifyFlowExists = async (): Promise<void> => {
      await client.upsert('Flow', {
        fullName: 'TestFlow',
        decisions: {
          processMetadataValues: {
            name: 'index',
            value: {
              numberValue: '0.0',
            },
          },
          name: 'myDecision',
          label: 'myDecision2',
          locationX: '50',
          locationY: '0',
          defaultConnectorLabel: 'default',
          rules: {
            name: 'myRule_1',
            conditionLogic: 'and',
            conditions: {
              processMetadataValues: [
                {
                  name: 'inputDataType',
                  value: {
                    stringValue: 'String',
                  },
                },
                {
                  name: 'leftHandSideType',
                  value: {
                    stringValue: 'String',
                  },
                },
                {
                  name: 'operatorDataType',
                  value: {
                    stringValue: 'String',
                  },
                },
                {
                  name: 'rightHandSideType',
                  value: {
                    stringValue: 'String',
                  },
                },
              ],
              leftValueReference: 'myVariable_current.FirstName',
              operator: 'EqualTo',
              rightValue: {
                stringValue: 'BLA',
              },
            },
            connector: {
              targetReference: 'myRule_1_A1',
            },
            label: 'NameIsBla',
          },
        },
        interviewLabel: 'TestFlow-1_InterviewLabel',
        label: 'TestFlow',
        processMetadataValues: [
          {
            name: 'ObjectType',
            value: {
              stringValue: 'Contact',
            },
          },
          {
            name: 'ObjectVariable',
            value: {
              elementReference: 'myVariable_current',
            },
          },
          {
            name: 'OldObjectVariable',
            value: {
              elementReference: 'myVariable_old',
            },
          },
          {
            name: 'TriggerType',
            value: {
              stringValue: 'onCreateOnly',
            },
          },
        ],
        processType: 'Workflow',
        recordUpdates: {
          processMetadataValues: [
            {
              name: 'evaluationType',
              value: {
                stringValue: 'always',
              },
            },
            {
              name: 'extraTypeInfo',
            },
            {
              name: 'isChildRelationship',
              value: {
                booleanValue: 'false',
              },
            },
            {
              name: 'reference',
              value: {
                stringValue: '[Contact]',
              },
            },
            {
              name: 'referenceTargetField',
            },
          ],
          name: 'myRule_1_A1',
          label: 'UpdateLastName',
          locationX: '100',
          locationY: '200',
          filters: {
            processMetadataValues: {
              name: 'implicit',
              value: {
                booleanValue: 'true',
              },
            },
            field: 'Id',
            operator: 'EqualTo',
            value: {
              elementReference: 'myVariable_current.Id',
            },
          },
          inputAssignments: {
            processMetadataValues: [
              {
                name: 'dataType',
                value: {
                  stringValue: 'String',
                },
              },
              {
                name: 'isRequired',
                value: {
                  booleanValue: 'false',
                },
              },
              {
                name: 'leftHandSideLabel',
                value: {
                  stringValue: 'Last Name',
                },
              },
              {
                name: 'leftHandSideReferenceTo',
              },
              {
                name: 'rightHandSideType',
                value: {
                  stringValue: 'String',
                },
              },
            ],
            field: 'LastName',
            value: {
              stringValue: 'Updated Name',
            },
          },
          object: 'Contact',
        },
        startElementReference: 'myDecision',
        status: 'Draft',
        variables: [
          {
            name: 'myVariable_current',
            dataType: 'SObject',
            isCollection: 'false',
            isInput: 'true',
            isOutput: 'true',
            objectType: 'Contact',
          },
          {
            name: 'myVariable_old',
            dataType: 'SObject',
            isCollection: 'false',
            isInput: 'true',
            isOutput: 'false',
            objectType: 'Contact',
          },
        ],
      } as MetadataInfo)
    }

    const verifyRolesExist = async (): Promise<void> => {
      await client.upsert('Role', {
        fullName: 'TestParentRole',
        name: 'TestParentRole',
        caseAccessLevel: 'Edit',
        contactAccessLevel: 'Edit',
        opportunityAccessLevel: 'Edit',
        description: 'TestParentRole',
        mayForecastManagerShare: 'false',
      } as MetadataInfo)

      await client.upsert('Role', {
        fullName: 'TestChildRole',
        name: 'TestChildRole',
        caseAccessLevel: 'Edit',
        contactAccessLevel: 'Edit',
        opportunityAccessLevel: 'Edit',
        description: 'TestChildRole',
        mayForecastManagerShare: 'false',
        parentRole: 'TestParentRole',
      } as MetadataInfo)
    }

    const verifyApexPageAndClassExist = async (): Promise<void> => {
      await client.deploy(await toMetadataPackageZip(
        'ApexClassForProfile',
        'ApexClass',
        {
          apiVersion: API_VERSION,
          content: "public class ApexClassForProfile {\n    public void printLog() {\n        System.debug('Created');\n    }\n}",
          fullName: 'ApexClassForProfile',
        },
        false,
      ) as Buffer)

      await client.deploy(await toMetadataPackageZip(
        'ApexPageForProfile',
        'ApexPage',
        {
          apiVersion: API_VERSION,
          content: '<apex:page>Created by e2e test for profile test!</apex:page>',
          fullName: 'ApexPageForProfile',
          label: 'ApexPageForProfile',
        },
        false,
      ) as Buffer)
    }

    const verifyLeadHasConvertSettings = async (): Promise<void> => {
      await client.upsert('LeadConvertSettings', {
        fullName: 'LeadConvertSettings',
        allowOwnerChange: 'true',
        objectMapping: {
          inputObject: 'Lead',
          mappingFields: [
            {
              inputField: 'CurrentGenerators__c',
              outputField: 'Active__c',
            },
          ],
          outputObject: 'Account',
        },
        opportunityCreationOptions: 'VisibleOptional',
      } as MetadataInfo)
    }

    await Promise.all([
      addCustomObjectWithVariousFields(),
      verifyEmailTemplateAndFolderExist(),
      verifyReportAndFolderExist(),
      verifyDashboardAndFolderExist(),
      verifyCustomObjectInnerTypesExist(),
      verifyLeadWorkflowInnerTypesExist(),
      verifyFlowExists(),
      verifyRolesExist(),
      verifyApexPageAndClassExist(),
      verifyLeadHasConvertSettings(),
    ])
    result = await adapter.fetch()
  })

  describe('should fetch account settings', () => {
    beforeEach(() => {
      expect(result).toBeDefined()
    })

    describe('should fetch sobject', () => {
      it('should fetch sobject fields', async () => {
        // Check few field types on lead object
        const lead = findStandardFieldsObject(result, 'Lead')
        // Test few possible types
        expect(lead.fields.Address.type.elemID).toEqual(Types.compoundDataTypes.Address.elemID)
        expect(lead.fields.Description.type.elemID).toEqual(
          Types.primitiveDataTypes.LongTextArea.elemID,
        )
        expect(lead.fields.Name.type.elemID).toEqual(Types.compoundDataTypes.Name.elemID)
        expect(lead.fields.OwnerId.type.elemID).toEqual(Types.primitiveDataTypes.Lookup.elemID)

        // Test label
        expect(lead.fields.Name.annotations[constants.LABEL]).toBe('Full Name')

        // Test true and false required
        expect(lead.fields.Description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(lead.fields.CreatedDate.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)

        // Test picklist restriction.enforce_value prop
        expect(lead.fields.Industry
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(false)
        expect(lead.fields.CleanStatus
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)

        // Test standard picklist values from a standard value set
        expect(lead.fields.LeadSource
          .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET]).toEqual(
          new ReferenceExpression(new ElemID(
            constants.SALESFORCE,
            STANDARD_VALUE_SET,
            'instance',
            'LeadSource',
          ).createNestedID(STANDARD_VALUE))
        )

        // Test picklist values
        expect(
          lead.fields.CleanStatus
            .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET]
            .map((val: Values) => val[constants.CUSTOM_VALUE.FULL_NAME]).sort()
        ).toEqual([
          'Acknowledged',
          'Different',
          'Inactive',
          'Matched',
          'NotFound',
          'Pending',
          'SelectMatch',
          'Skipped',
        ])

        // Test lookup reference_to annotation
        expect(
          lead.fields.OwnerId.annotations[constants.FIELD_ANNOTATIONS.REFERENCE_TO]
        ).toEqual(['Group', 'User'])

        // Test lookup allow_lookup_record_deletion annotation
        expect(
          lead.fields.OwnerId.annotations[constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]
        ).toBe(true)

        // Test default value for checkbox
        expect(lead.fields.IsConverted.annotations[constants.FIELD_ANNOTATIONS.DEFAULT_VALUE])
          .toBe(false)
      })

      describe('should fetch sobject annotations from the custom object instance', () => {
        it('should fetch relevant simple annotations for standard object', () => {
          const lead = findAnnotationsObject(result, 'Lead')
          expect(lead.annotationTypes).toHaveProperty('enableFeeds')
          expect(lead.annotations.enableFeeds).toBeDefined()

          expect(lead.annotationTypes).not.toHaveProperty('deploymentStatus')
          expect(lead.annotations.deploymentStatus).toBeUndefined()
        })

        it('should fetch relevant simple annotations for custom object', () => {
          const customObj = findAnnotationsObject(result, 'TestFields__c')
          expect(customObj.annotationTypes).toHaveProperty('enableFeeds')
          expect(customObj.annotations.enableFeeds).toBeDefined()
          expect(customObj.annotationTypes).toHaveProperty('deploymentStatus')
          expect(customObj.annotations.deploymentStatus).toBeDefined()
        })
      })

      describe('should fetch inner metadata types from the custom object instance', () => {
        const verifyInnerMetadataInstanceFetch = (typeName: string, expectedName: string,
          expectedValues: Values): void => {
          const innerMetadataInstance = findElements(result, typeName, expectedName)[0] as
            InstanceElement
          expect(innerMetadataInstance).toBeDefined()
          Object.entries(expectedValues)
            .forEach(([key, val]) => expect(innerMetadataInstance.value[key]).toEqual(val))
        }

        it('should fetch validation rules', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.VALIDATION_RULE,
            'Lead_TestValidationRule',
            { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestValidationRule', active: true })
        })

        it('should fetch business processes', async () => {
          verifyInnerMetadataInstanceFetch(
            NESTED_INSTANCE_TYPE_NAME.BUSINESS_PROCESS, 'Lead_TestBusinessProcess',
            { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestBusinessProcess', isActive: true }
          )
        })

        it('should fetch record types', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.RECORD_TYPE,
            'Lead_TestRecordType', { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestRecordType',
              active: true,
              businessProcess: 'TestBusinessProcess' })
        })

        it('should fetch web links', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.WEB_LINK,
            'Lead_TestWebLink', { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestWebLink',
              availability: 'online' })
        })

        it('should fetch list views', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.LIST_VIEW,
            'Lead_TestListView', { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestListView',
              label: 'E2E Fetch ListView' })
        })

        it('should fetch field sets', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.FIELD_SET,
            'Lead_TestFieldSet', { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestFieldSet',
              label: 'E2E Fetch FieldSet' })
        })

        it('should fetch compact layouts', async () => {
          verifyInnerMetadataInstanceFetch(NESTED_INSTANCE_TYPE_NAME.COMPACT_LAYOUT,
            'Lead_TestCompactLayout',
            { [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.TestCompactLayout',
              label: 'E2E Fetch CompactLayout' })
        })
      })
    })

    it('should fetch metadata type', () => {
      const flow = findElements(result, 'Flow')[0] as ObjectType
      expect(flow.fields.description.type).toEqual(BuiltinTypes.STRING)
      expect(flow.fields.isTemplate.type).toEqual(BuiltinTypes.BOOLEAN)
      expect(flow.fields.actionCalls.type).toEqual(findElements(result, 'FlowActionCall')[0])
      expect(flow.fields.processType
        .annotations[CORE_ANNOTATIONS.RESTRICTION][RESTRICTION_ANNOTATIONS.ENFORCE_VALUE])
        .toEqual(false)
    })

    it('should fetch settings instance', () => {
      // As we fetch now only instances from the STANDALONE list,
      // settings is the only one with instance by default.
      // once we support adding instances test can be improved
      const quoteSettings = findElements(result, 'SettingsQuote')
        .filter(isInstanceElement)
        .pop() as InstanceElement

      expect(quoteSettings).toBeUndefined()
    })

    it('should fetch LeadConvertSettings instance with correct path', () => {
      const convertSettingsInstance = findElements(result,
        constants.LEAD_CONVERT_SETTINGS_METADATA_TYPE,
        constants.LEAD_CONVERT_SETTINGS_METADATA_TYPE).pop() as InstanceElement

      expect(convertSettingsInstance).toBeDefined()
      expect(convertSettingsInstance.path)
        .toEqual([constants.SALESFORCE, constants.OBJECTS_PATH, 'Lead',
          constants.LEAD_CONVERT_SETTINGS_METADATA_TYPE])
    })

    it('should retrieve EmailTemplate instance', () => {
      const emailTemplate = findElements(result, 'EmailTemplate',
        'TestEmailFolder_TestEmailTemplate')[0] as InstanceElement
      expect(emailTemplate.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestEmailFolder/TestEmailTemplate')
      expect(emailTemplate.value.name).toEqual('Test Email Template Name')
      expect(emailTemplate.value.type).toEqual('text')
    })

    it('should retrieve EmailFolder instance', () => {
      const emailFolder = findElements(result, 'EmailFolder',
        'TestEmailFolder')[0] as InstanceElement
      expect(emailFolder.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('TestEmailFolder')
      expect(emailFolder.value.name).toEqual('Test Email Folder Name')
      expect(emailFolder.value.accessType).toEqual('Public')
    })

    it('should retrieve Report instance', () => {
      const report = findElements(result, 'Report',
        'TestReportFolder_TestReport')[0] as InstanceElement
      expect(report.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestReportFolder/TestReport')
      expect(report.value.name).toEqual('Test Report Name')
    })

    it('should retrieve ReportFolder instance', () => {
      const reportFolder = findElements(result, 'ReportFolder',
        'TestReportFolder')[0] as InstanceElement
      expect(reportFolder.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('TestReportFolder')
      expect(reportFolder.value.name).toEqual('Test Report Folder Name')
    })

    it('should retrieve Dashboard instance', () => {
      const dashboard = findElements(result, 'Dashboard',
        'TestDashboardFolder_TestDashboard')[0] as InstanceElement
      expect(dashboard.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestDashboardFolder/TestDashboard')
      expect(dashboard.value.title).toEqual('Test Dashboard Title')
    })

    it('should retrieve DashboardFolder instance', () => {
      const dashboardFolder = findElements(result, 'DashboardFolder',
        'TestDashboardFolder')[0] as InstanceElement
      expect(dashboardFolder.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestDashboardFolder')
      expect(dashboardFolder.value.name).toEqual('Test Dashboard Folder Name')
    })

    it('should fetch Flow instance', () => {
      const flow = findElements(result, 'Flow', 'TestFlow')[0] as InstanceElement
      expect(flow.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('TestFlow')
      expect(flow.value.status).toEqual('Draft')
      expect(flow.value.variables[0].dataType).toEqual('SObject')
      expect(flow.value.processType).toEqual('Workflow')
    })

    describe('should fetch Workflow instance', () => {
      it('should fetch workflow alerts', async () => {
        const leadWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
        expect(leadWorkflow.value[WORKFLOW_ALERTS_FIELD]).toBeDefined()
        const workflowAlert = makeArray(leadWorkflow.value[WORKFLOW_ALERTS_FIELD])
          .find(alert => alert[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestWorkflowAlert')
        expect(workflowAlert.description).toEqual('E2E Fetch WorkflowAlert')
      })

      it('should fetch workflow field updates', async () => {
        const leadWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
        expect(leadWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD]).toBeDefined()
        const workflowFieldUpdate = makeArray(leadWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD])
          .find(alert => alert[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestWorkflowFieldUpdate')
        expect(workflowFieldUpdate.description).toEqual('E2E Fetch WorkflowFieldUpdate')
      })

      it('should fetch workflow task', async () => {
        const leadWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
        expect(leadWorkflow.value[WORKFLOW_TASKS_FIELD]).toBeDefined()
        const workflowTask = makeArray(leadWorkflow.value[WORKFLOW_TASKS_FIELD])
          .find(task => task[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestWorkflowTask')
        expect(workflowTask.description).toEqual('E2E Fetch WorkflowTask')
      })

      it('should fetch workflow rule', async () => {
        const leadWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
        expect(leadWorkflow.value[WORKFLOW_RULES_FIELD]).toBeDefined()
        const workflowRule = makeArray(leadWorkflow.value[WORKFLOW_RULES_FIELD])
          .find(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestWorkflowRule')
        expect(workflowRule.description).toEqual('E2E Fetch WorkflowRule')
      })

      it('should set workflow instance path correctly', async () => {
        const leadWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
        expect(leadWorkflow.path)
          .toEqual([constants.SALESFORCE, constants.OBJECTS_PATH, 'Lead', 'WorkflowRules'])
      })
    })
  })

  describe('should perform CRUD operations', () => {
    // The following const method is a workaround for a bug in SFDC metadata API that returns
    // the fields in FieldPermissions and ObjectPermissions as string instead of boolean
    const verifyBoolean = (variable: string | boolean): boolean => (
      typeof variable === 'string' ? JSON.parse(variable) : variable)

    const getProfileInfo = async (profile: string): Promise<ProfileInfo> =>
      (await client.readMetadata(PROFILE_METADATA_TYPE, profile))[0] as ProfileInfo

    const fieldPermissionExists = async (profile: string, fields: string[]): Promise<boolean[]> => {
      const profileInfo = await getProfileInfo(profile)
      const fieldPermissionsMap = new Map<string, FieldPermissions>()
      profileInfo.fieldPermissions.map(f => fieldPermissionsMap.set(f.field, f))
      return fields.map(field => {
        if (!fieldPermissionsMap.has(field)) {
          return false
        }
        const fieldObject: FieldPermissions = fieldPermissionsMap.get(field) as FieldPermissions
        return verifyBoolean(fieldObject.editable) || verifyBoolean(fieldObject.readable)
      })
    }

    const objectPermissionExists = async (profile: string, objects: string[]):
     Promise<boolean[]> => {
      const profileInfo = await getProfileInfo(profile)
      const objectPermissionsMap = new Map<string, ObjectPermissions>()
      profileInfo.objectPermissions.map(f => objectPermissionsMap.set(f.object, f))
      return objects.map(object => {
        if (!objectPermissionsMap.has(object)) {
          return false
        }
        const objectPermission: ObjectPermissions = objectPermissionsMap
          .get(object) as ObjectPermissions
        return verifyBoolean(objectPermission.allowCreate)
         || verifyBoolean(objectPermission.allowDelete)
         || verifyBoolean(objectPermission.allowEdit)
         || verifyBoolean(objectPermission.allowRead)
         || verifyBoolean(objectPermission.modifyAllRecords)
         || verifyBoolean(objectPermission.viewAllRecords)
      })
    }

    const stringType = Types.primitiveDataTypes.Text

    it('should add new profile instance from scratch', async () => {
      const instanceElementName = 'TestAddProfileInstance__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')

      const instance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: true,
            editable: false,
          },
          {
            editable: false,
            field: 'Account.AccountNumber',
            readable: false,
          },
        ],
        objectPermissions: [
          {
            allowCreate: true,
            allowDelete: true,
            allowEdit: true,
            allowRead: true,
            modifyAllRecords: false,
            viewAllRecords: false,
            object: 'Account',
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        userPermissions: [
          {
            enabled: false,
            name: 'ConvertLeads',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: false,
            visible: true,
          },
        ],
        description: 'new e2e profile',
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,
      })

      if (await objectExists(PROFILE_METADATA_TYPE, apiName(instance))) {
        await adapter.remove(instance)
      }

      const post = await adapter.add(instance) as InstanceElement

      // Test
      expect(post).toMatchObject(instance)

      expect(
        await objectExists(
          post.type.annotations[constants.METADATA_TYPE], apiName(post)
        )
      ).toBeTruthy()

      // Clean-up
      await adapter.remove(post)
    })

    it('should add custom object', async () => {
      const customObjectName = 'TestAddCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const nameFieldElemID = new ElemID(constants.SALESFORCE, 'NameField')
      const element = new ObjectType({
        elemID: mockElemID,
        annotationTypes: {
          deploymentStatus: BuiltinTypes.STRING,
          enableHistory: BuiltinTypes.BOOLEAN,
          nameField: new ObjectType({ elemID: nameFieldElemID,
            fields: {
              [constants.LABEL]: new Field(nameFieldElemID, constants.LABEL, BuiltinTypes.STRING),
              type: new Field(nameFieldElemID, 'type', BuiltinTypes.STRING),
              displayFormat: new Field(nameFieldElemID, 'displayFormat', BuiltinTypes.STRING),
              startingNumber: new Field(nameFieldElemID, 'startingNumber', BuiltinTypes.NUMBER),
            } }),
        },
        annotations: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          deploymentStatus: 'InDevelopment',
          enableHistory: true,
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'AutoNumber',
            displayFormat: 'BLA-{0000}',
            startingNumber: 123,
          },
          [constants.OBJECT_LEVEL_SECURITY_ANNOTATION]: {
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_CREATE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_DELETE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_EDIT]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_READ]: [ADMIN, STANDARD],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.MODIFY_ALL_RECORDS]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.VIEW_ALL_RECORDS]: [ADMIN],
          },
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: '"test"',
              [constants.LABEL]: 'description label',
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
          formula: new Field(
            mockElemID,
            'formula',
            stringType,
            {
              [constants.LABEL]: 'Test formula',
              [constants.FORMULA]: '"some text"',
            },
          ),
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const post = await adapter.add(element) as ObjectType

      // Test
      expect(post).toBeInstanceOf(ObjectType)
      expect(
        post.fields.description.annotations[constants.API_NAME]
      ).toBe('TestAddCustom__c.description__c')
      expect(
        post.fields.formula.annotations[constants.API_NAME]
      ).toBe('TestAddCustom__c.formula__c')

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName,
        ['description__c', 'formula__c'], undefined, {
          deploymentStatus: 'InDevelopment',
          enableHistory: 'true',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'AutoNumber',
            displayFormat: 'BLA-{0000}',
            trackHistory: 'false',
          },
        }))
        .toBe(true)
      expect((await fieldPermissionExists('Admin', [`${customObjectName}.description__c`]))[0]).toBe(true)
      expect((await fieldPermissionExists('Standard', [`${customObjectName}.description__c`]))[0]).toBe(true)
      expect((await objectPermissionExists('Admin', [`${customObjectName}`]))[0]).toBe(true)
      expect((await objectPermissionExists('Standard', [`${customObjectName}`]))[0]).toBe(true)

      // Clean-up
      await adapter.remove(post)
    })

    it('should remove object', async () => {
      const customObjectName = 'TestRemoveCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test remove custom')
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [constants.LABEL]: 'test label',
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: '"test"',
            },
          ),
        },
      })
      // Setup
      if (!await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.add(element)
        expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)
      }
      // Run
      const removeResult = await adapter.remove(element)
      // Validate
      expect(removeResult).toBeUndefined()
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(false)
    })

    it('should modify an object by creating a new custom field and remove another one', async () => {
      const customObjectName = 'TestModifyCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify fields')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
            },
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Address__c', 'Banana__c'])).toBe(true)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
            },
          ),
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test2 label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [
          { action: 'add', data: { after: newElement.fields.description } },
          { action: 'remove', data: { before: oldElement.fields.address } },
        ])

      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Banana__c', 'description__c'],
        ['Address__c'])).toBe(true)
      expect((await fieldPermissionExists('Admin', [`${customObjectName}.description__c`]))[0]).toBe(true)

      // Clean-up
      await adapter.remove(oldElement)
    })

    it('should modify an instance', async () => {
      const instanceElementName = 'TestProfileInstanceUpdate__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const oldInstance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: 'true',
            editable: 'false',
          },
          {
            editable: 'false',
            field: 'Account.AccountNumber',
            readable: 'false',
          },
        ],
        objectPermissions: [
          {
            allowCreate: 'true',
            allowDelete: 'true',
            allowEdit: 'true',
            allowRead: 'true',
            modifyAllRecords: 'false',
            viewAllRecords: 'false',
            object: 'Account',
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: 'false',
            visible: 'true',
          },
        ],
        userPermissions: [
          {
            name: 'ApiEnabled',
            enabled: 'false',
          },
        ],
        pageAccesses: [
          {
            apexPage: 'ApexPageForProfile',
            enabled: 'false',
          },
        ],
        classAccesses: [
          {
            apexClass: 'ApexClassForProfile',
            enabled: 'false',
          },
        ],
        loginHours: {
          sundayStart: '480',
          sundayEnd: '1380',
        },
        description: 'new e2e profile',
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,

      })

      const newInstance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
          [constants.API_NAME]: instanceElementName,
        },
      }),
      {
        fieldPermissions: [
          {
            field: 'Lead.Fax',
            readable: 'true',
            editable: 'true',
          },
          {
            editable: 'false',
            field: 'Account.AccountNumber',
            readable: 'false',
          },
          {
            editable: 'false',
            field: 'Account.AnnualRevenue',
            readable: 'false',
          },
        ],
        objectPermissions: [
          {
            allowCreate: 'true',
            allowDelete: 'true',
            allowEdit: 'true',
            allowRead: 'true',
            modifyAllRecords: 'true',
            viewAllRecords: 'true',
            object: 'Account',
          },
        ],
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOff',
          },
        ],
        applicationVisibilities: [
          {
            application: 'standard__ServiceConsole',
            default: 'false',
            visible: 'true',
          },
        ],
        userPermissions: [
          {
            name: 'ApiEnabled',
            enabled: 'true',
          },
        ],
        pageAccesses: [
          {
            apexPage: 'ApexPageForProfile',
            enabled: 'true',
          },
        ],
        classAccesses: [
          {
            apexClass: 'ApexClassForProfile',
            enabled: 'true',
          },
        ],
        loginHours: {
          sundayStart: '300',
          sundayEnd: '420',
        },
        description: 'updated e2e profile',
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,

      })

      if (await objectExists(PROFILE_METADATA_TYPE, apiName(oldInstance))) {
        await adapter.remove(oldInstance)
      }

      const post = await adapter.add(oldInstance) as InstanceElement
      const updateResult = await adapter.update(oldInstance, newInstance, [])

      // Test
      expect(updateResult).toStrictEqual(newInstance)

      // Checking that the saved instance identical to newInstance
      const savedInstance = (await client.readMetadata(
        PROFILE_METADATA_TYPE, apiName(newInstance)
      ))[0] as Profile

      type Profile = ProfileInfo & {
        tabVisibilities: Record<string, Value>
        applicationVisibilities: Record<string, Value>
        objectPermissions: Record<string, Value>
        userPermissions: Record<string, Value>
        pageAccesses: Record<string, Value>
        classAccesses: Record<string, Value>
        loginHours: Values
      }

      const valuesMap = new Map<string, Value>()
      const newValues = newInstance.value
      savedInstance.fieldPermissions.forEach(f => valuesMap.set(f.field, f))
      savedInstance.tabVisibilities.forEach((f: Value) => valuesMap.set(f.tab, f))
      savedInstance.applicationVisibilities.forEach((f: Value) => valuesMap.set(f.application, f))
      savedInstance.objectPermissions.forEach((f: Value) => valuesMap.set(f.object, f))
      savedInstance.userPermissions.forEach((f: Value) => valuesMap.set(f.name, f))
      makeArray(savedInstance.pageAccesses).forEach((f: Value) => valuesMap.set(f.apexPage, f))
      makeArray(savedInstance.classAccesses).forEach((f: Value) => valuesMap.set(f.apexClass, f))

      expect((newValues.fieldPermissions as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.field)))).toBeTruthy()

      expect((newValues.tabVisibilities as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.tab)))).toBeTruthy()

      expect((newValues.applicationVisibilities as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.application)))).toBeTruthy()

      expect((newValues.objectPermissions as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.object)))).toBeTruthy()

      expect((newValues.userPermissions as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.name)))).toBeTruthy()

      expect((newValues.pageAccesses as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.apexPage)))).toBeTruthy()

      expect((newValues.classAccesses as []).some((v: Value) =>
        _.isEqual(v, valuesMap.get(v.apexClass)))).toBeTruthy()

      expect(newValues.loginHours).toEqual(savedInstance.loginHours)

      // Clean-up
      await adapter.remove(post)
      expect(await objectExists(PROFILE_METADATA_TYPE, apiName(oldInstance))).toBe(false)
    })

    // This test should be removed and replace with an appropriate one as soon as SALTO-551 is done
    it('should not fetch tabVisibilities from profile', () => {
      const [adminProfile] = result
        .filter(isInstanceElement)
        .filter(e => metadataType(e) === PROFILE_METADATA_TYPE)
        .filter(e => apiName(e) === ADMIN) as InstanceElement[]
      expect(adminProfile.value.tabVisibilities).toBeUndefined()
    })

    it("should modify an object's annotations", async () => {
      const customObjectName = 'TestModifyCustomAnnotations__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify annotations')
      const nameFieldElemID = new ElemID(constants.SALESFORCE, 'NameField')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [constants.LABEL]: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
              [constants.LABEL]: 'Banana',
              [constants.BUSINESS_STATUS]: 'Active',
              [constants.SECURITY_CLASSIFICATION]: 'Public',
            },
          ),
        },
        annotationTypes: {
          deploymentStatus: BuiltinTypes.STRING,
          nameField: new ObjectType({ elemID: nameFieldElemID,
            fields: {
              [constants.LABEL]: new Field(nameFieldElemID, constants.LABEL, BuiltinTypes.STRING),
              type: new Field(nameFieldElemID, 'type', BuiltinTypes.STRING),
              displayFormat: new Field(nameFieldElemID, 'displayFormat', BuiltinTypes.STRING),
              startingNumber: new Field(nameFieldElemID, 'startingNumber', BuiltinTypes.NUMBER),
            } }),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          deploymentStatus: 'InDevelopment',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'AutoNumber',
            displayFormat: 'BLA-{0000}',
            startingNumber: 123,
          },
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      await adapter.add(oldElement)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [constants.LABEL]: 'Address',
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
              [constants.LABEL]: 'Banana Split',
              [constants.BUSINESS_STATUS]: 'Hidden',
              [constants.SECURITY_CLASSIFICATION]: 'Restricted',
              [constants.COMPLIANCE_GROUP]: 'GDPR',
            },
          ),
        },
        annotationTypes: {
          deploymentStatus: BuiltinTypes.STRING,
          nameField: new ObjectType({ elemID: nameFieldElemID,
            fields: {
              [constants.LABEL]: new Field(nameFieldElemID, constants.LABEL, BuiltinTypes.STRING),
              type: new Field(nameFieldElemID, 'type', BuiltinTypes.STRING),
              displayFormat: new Field(nameFieldElemID, 'displayFormat', BuiltinTypes.STRING),
              startingNumber: new Field(nameFieldElemID, 'startingNumber', BuiltinTypes.NUMBER),
            } }),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test label 2',
          [constants.API_NAME]: customObjectName,
          deploymentStatus: 'Deployed',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'Text',
          },
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [
          {
            action: 'modify',
            data: {
              before: oldElement.fields.banana,
              after: newElement.fields.banana,
            },
          },
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ])
      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, undefined, undefined,
        {
          [constants.LABEL]: 'test label 2',
          deploymentStatus: 'Deployed',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'Text',
          },
        })).toBe(true)
      const readResult = (await client.readMetadata(
        constants.CUSTOM_OBJECT,
        customObjectName
      ))[0] as CustomObject
      const field = makeArray(readResult.fields).filter(f => f.fullName === 'Banana__c')[0]
      expect(field).toBeDefined()
      expect(field.label).toBe('Banana Split')
      expect(field.securityClassification).toBe('Restricted')
      expect(field.businessStatus).toBe('Hidden')
      expect(field.complianceGroup).toBe('GDPR')

      // Clean-up
      await adapter.remove(oldElement)
    })

    it('should modify field and object annotation', async () => {
      const customObjectName = 'TestModifyFieldAndAnnotation__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify field and annotation')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [constants.LABEL]: 'Field Label',
            },
          ),
        },
        annotations: {
          [constants.LABEL]: 'Object Label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      await adapter.add(oldElement)

      const newElement = oldElement.clone()
      newElement.annotations.label = 'Object Updated Label'
      newElement.fields.address.annotations.label = 'Field Updated Label'

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [
          {
            action: 'modify',
            data: { before: oldElement.fields.address, after: newElement.fields.address },
          },
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ])
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, undefined, undefined,
        { [constants.LABEL]: 'Object Updated Label' })).toBeTruthy()
      const addressFieldInfo = (await client.readMetadata(constants.CUSTOM_FIELD,
        apiNameAnno(customObjectName, 'Address__c')))[0] as CustomField
      expect(addressFieldInfo.label).toEqual('Field Updated Label')

      // Clean-up
      await adapter.remove(oldElement)
    })

    it("should modify an object's object permissions", async () => {
      const customObjectName = 'TestModifyObjectPermissions__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify object permissions')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.OBJECT_LEVEL_SECURITY_ANNOTATION]: {
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_CREATE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_DELETE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_EDIT]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_READ]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.MODIFY_ALL_RECORDS]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.VIEW_ALL_RECORDS]: [ADMIN],
          },
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      expect((await objectPermissionExists('Standard', [`${customObjectName}`]))[0]).toBeFalsy()
      expect((await objectPermissionExists('Admin', [`${customObjectName}`]))[0]).toBeTruthy()

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.OBJECT_LEVEL_SECURITY_ANNOTATION]: {
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_CREATE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_DELETE]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_EDIT]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_READ]: [ADMIN, STANDARD],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.MODIFY_ALL_RECORDS]: [ADMIN],
            [constants.OBJECT_LEVEL_SECURITY_FIELDS.VIEW_ALL_RECORDS]: [ADMIN],
          },
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement, [
        { action: 'modify',
          data: { before: oldElement,
            after: newElement } },
      ])
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)

      expect(await objectPermissionExists('Standard', [`${customObjectName}`])).toBeTruthy()
      expect(await objectPermissionExists('Admin', [`${customObjectName}`])).toBeTruthy()
    })

    it("should modify an object's custom fields' permissions", async () => {
      // Setup
      const customObjectName = 'TestModifyCustomFieldsPermissions__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify custom field permissions')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN],
                readable: [ADMIN],
              },
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [STANDARD],
                readable: [STANDARD],
              },
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Delta__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [STANDARD],
                readable: [STANDARD],
              },
            },
          ),
          banana: new Field(
            mockElemID,
            'banana',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                editable: [ADMIN, STANDARD],
                readable: [ADMIN, STANDARD],
              },
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            stringType,
            {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Delta__c'),
              [FIELD_LEVEL_SECURITY_ANNOTATION]: {
                readable: [STANDARD],
              },
            },
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement, [
        { action: 'modify',
          data: { before: oldElement.fields.address, after: newElement.fields.address } },
        { action: 'modify',
          data: { before: oldElement.fields.banana, after: newElement.fields.banana } },
        { action: 'modify',
          data: { before: oldElement.fields.delta, after: newElement.fields.delta } },
      ])
      expect(modificationResult).toBeInstanceOf(ObjectType)

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)

      const [addressStandardExists,
        bananaStandardExists,
        deltaStandardExists] = await fieldPermissionExists(
        'Standard',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`, `${customObjectName}.Delta__c`]
      )
      expect(addressStandardExists).toBeTruthy()
      expect(bananaStandardExists).toBeTruthy()
      expect(deltaStandardExists).toBeTruthy()
      const [addressAdminExists,
        bananaAdminExists,
        deltaAdminExists] = await fieldPermissionExists(
        'Admin',
        [`${customObjectName}.Address__c`, `${customObjectName}.Banana__c`, `${customObjectName}.Delta__c`]
      )
      expect(addressAdminExists).toBeFalsy()
      expect(bananaAdminExists).toBeTruthy()
      expect(deltaAdminExists).toBeFalsy()

      // Clean-up
      await adapter.remove(oldElement)
    })

    describe('should fetch and add custom object with various field types', () => {
      const testCurrency = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Currency label')
        expect(annotations[constants.DESCRIPTION]).toBe('Currency description')
        expect(annotations[constants.HELP_TEXT]).toBe('Currency help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.SCALE]).toBe(3)
        expect(annotations[constants.FIELD_ANNOTATIONS.PRECISION]).toBe(18)
        expect(annotations[constants.DEFAULT_VALUE_FORMULA]).toEqual('25')
      }

      const testAutoNumber = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Autonumber label')
        expect(annotations[constants.DESCRIPTION]).toBe('Autonumber description')
        expect(annotations[constants.HELP_TEXT]).toBe('Autonumber help')
        expect(annotations[constants.FIELD_ANNOTATIONS.EXTERNAL_ID]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]).toBe('ZZZ-{0000}')
      }

      const testDate = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Date label')
        expect(annotations[constants.DESCRIPTION]).toBe('Date description')
        expect(annotations[constants.HELP_TEXT]).toBe('Date help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.DEFAULT_VALUE_FORMULA]).toEqual('Today() + 7')
      }

      const testTime = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Time label')
        expect(annotations[constants.DESCRIPTION]).toBe('Time description')
        expect(annotations[constants.HELP_TEXT]).toBe('Time help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
        expect(annotations[constants.DEFAULT_VALUE_FORMULA]).toBe('TIMENOW() + 5')
      }

      const testDatetime = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('DateTime label')
        expect(annotations[constants.DESCRIPTION]).toBe('DateTime description')
        expect(annotations[constants.HELP_TEXT]).toBe('DateTime help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.DEFAULT_VALUE_FORMULA]).toBe('NOW() + 7')
      }

      const testEmail = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Email label')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.FIELD_ANNOTATIONS.UNIQUE]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.EXTERNAL_ID]).toBe(true)
      }

      const testLocation = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Location label')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL])
          .toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.SCALE]).toBe(2)
      }

      const testPicklist = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Picklist label')
        expect(annotations[constants.DESCRIPTION]).toBe('Picklist description')
        expect(annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.VALUE_SET]).toEqual([
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'NEW',
            [constants.CUSTOM_VALUE.DEFAULT]: true,
            [constants.CUSTOM_VALUE.LABEL]: 'NEW',
            [constants.CUSTOM_VALUE.COLOR]: '#FF0000',
          },
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'OLD',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'OLD',
          },
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'OLDEST',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'OLDEST',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: false,
          },
        ])
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testMultiSelectPicklist = (annotations: Values, sorted = false): void => {
        expect(annotations[constants.LABEL]).toBe('Multipicklist label')
        expect(annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(false)
        expect(annotations[constants.FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(4)
        const expectedValueSet = [
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'RE',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'RE',
          },
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'DO',
            [constants.CUSTOM_VALUE.DEFAULT]: true,
            [constants.CUSTOM_VALUE.LABEL]: 'DO',
          },
        ]
        expect(annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual(sorted
            ? _.sortBy(expectedValueSet, constants.CUSTOM_VALUE.FULL_NAME)
            : expectedValueSet)
        const fieldDependency = annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency[constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD])
          .toEqual(picklistFieldName)
        expect(fieldDependency[constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS])
          .toEqual([
            {
              [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['NEW', 'OLD'],
              [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'DO',
            },
            {
              [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['OLD'],
              [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'RE',
            },
          ])
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testPercent = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Percent label')
        expect(annotations[constants.DESCRIPTION]).toBe('Percent description')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.FIELD_ANNOTATIONS.PRECISION]).toBe(12)
        expect(annotations[constants.FIELD_ANNOTATIONS.SCALE]).toBe(3)
      }

      const testPhone = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Phone label')
        expect(annotations[constants.HELP_TEXT]).toBe('Phone help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
      }

      const testLongTextArea = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('LongTextArea label')
        expect(annotations[constants.FIELD_ANNOTATIONS.LENGTH]).toBe(32700)
        expect(annotations[constants.FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(5)
      }

      const testRichTextArea = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('RichTextArea label')
        expect(annotations[constants.DESCRIPTION]).toBe('RichTextArea description')
        expect(annotations[constants.HELP_TEXT]).toBe('RichTextArea help')
        expect(annotations[constants.FIELD_ANNOTATIONS.LENGTH]).toBe(32600)
        expect(annotations[constants.FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(32)
      }

      const testTextArea = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('TextArea label')
        expect(annotations[constants.DESCRIPTION]).toBe('TextArea description')
        expect(annotations[constants.HELP_TEXT]).toBe('TextArea help')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testEncryptedText = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('EncryptedText label')
        expect(annotations[constants.FIELD_ANNOTATIONS.LENGTH]).toBe(35)
        expect(annotations[constants.FIELD_ANNOTATIONS.MASK_CHAR]).toBe('asterisk')
        expect(annotations[constants.FIELD_ANNOTATIONS.MASK_TYPE]).toBe('creditCard')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testUrl = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Url label')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testNumber = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Number label')
        expect(annotations[constants.FIELD_ANNOTATIONS.PRECISION]).toBe(15)
        expect(annotations[constants.FIELD_ANNOTATIONS.SCALE]).toBe(3)
        expect(annotations[constants.FIELD_ANNOTATIONS.UNIQUE]).toBe(true)
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.DEFAULT_VALUE_FORMULA]).toBe('42')
      }

      const testText = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Text label')
        expect(annotations[constants.FIELD_ANNOTATIONS.LENGTH]).toBe(100)
        expect(annotations[constants.FIELD_ANNOTATIONS.EXTERNAL_ID]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]).toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.UNIQUE]).toBe(true)
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      }

      const testCheckbox = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Checkbox label')
        expect(annotations[constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]).toBe(true)
      }

      const testGlobalPicklist = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Global Picklist label')
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)
      }

      const testLookup = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Lookup label')
        expect(annotations[constants.FIELD_ANNOTATIONS.REFERENCE_TO]).toEqual(['Opportunity'])
        expect(annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        const lookupFilter = annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
        expect(lookupFilter).toBeDefined()
        expect(lookupFilter[constants.LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
        expect(lookupFilter[constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]).toBe('1 OR 2')
        expect(lookupFilter[constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE])
          .toBe('This is the Error message')
        expect(lookupFilter[constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE])
          .toBe('This is the Info message')
        expect(lookupFilter[constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(false)
        const filterItems = lookupFilter[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]
        expect(filterItems).toBeDefined()
        expect(filterItems).toEqual([{
          [constants.FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.OwnerId',
          [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
          [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id',
        },
        {
          [constants.FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.NextStep',
          [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
          [constants.FILTER_ITEM_FIELDS.VALUE]: 'NextStepValue',
        }])
      }

      const testMasterDetail = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('MasterDetail label')
        expect(annotations[constants.FIELD_ANNOTATIONS.REFERENCE_TO]).toEqual(['Case'])
        expect(annotations[constants.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL])
          .toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ])
          .toBe(true)
        expect(annotations[constants.FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]).toBe(0)
      }

      const testSummary = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toEqual('Summary label')
        expect(annotations[constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
          .toEqual('Opportunity.Amount')
        expect(annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
          .toEqual('Opportunity.AccountId')
        expect(annotations[constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION])
          .toEqual('sum')
        const filterItems = annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
        expect(filterItems).toHaveLength(1)
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.FIELD]).toEqual('Opportunity.Amount')
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.OPERATION]).toEqual('greaterThan')
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.VALUE]).toEqual('1')
      }

      const testFormula = (annotations: Values): void => {
        expect(annotations[constants.LABEL]).toBe('Formula Checkbox label')
        expect(annotations[constants.FORMULA]).toBe('5 > 4')
        expect(annotations[constants.FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS]).toBe('BlankAsZero')
        expect(annotations[constants.BUSINESS_STATUS]).toBe('Hidden')
        expect(annotations[constants.SECURITY_CLASSIFICATION]).toBe('Restricted')
      }

      describe('fetch', () => {
        let customFieldsObject: ObjectType

        beforeAll(() => {
          customFieldsObject = findCustomFieldsObject(result, customObjectWithFieldsName)
        })

        describe('fetch fields', () => {
          const verifyFieldFetch = (
            field: Field,
            verificationFunc: (annotations: Values) => void,
            expectedType: TypeElement
          ): void => {
            expect(field).toBeDefined()
            verificationFunc(field.annotations)
            expect(field.type.elemID).toEqual(expectedType.elemID)
          }

          let fields: Record<string, Field>
          beforeAll(() => {
            fields = customFieldsObject.fields
          })

          it('currency', () => {
            verifyFieldFetch(
              fields[currencyFieldName],
              testCurrency,
              Types.primitiveDataTypes.Currency
            )
          })

          it('autonumber', () => {
            verifyFieldFetch(
              fields[autoNumberFieldName],
              testAutoNumber,
              Types.primitiveDataTypes.AutoNumber
            )
          })

          it('date', () => {
            verifyFieldFetch(fields[dateFieldName], testDate, Types.primitiveDataTypes.Date)
          })

          it('time', () => {
            verifyFieldFetch(fields[timeFieldName], testTime, Types.primitiveDataTypes.Time)
          })

          it('datetime', () => {
            verifyFieldFetch(
              fields[dateTimeFieldName],
              testDatetime,
              Types.primitiveDataTypes.DateTime
            )
          })

          it('email', () => {
            verifyFieldFetch(
              fields[emailFieldName],
              testEmail,
              Types.primitiveDataTypes.Email
            )
          })

          it('location', () => {
            verifyFieldFetch(
              fields[locationFieldName],
              testLocation,
              Types.compoundDataTypes.Location
            )
          })

          it('picklist', () => {
            verifyFieldFetch(
              fields[picklistFieldName],
              testPicklist,
              Types.primitiveDataTypes.Picklist
            )
          })

          it('global picklist', () => {
            const field = fields[globalPicklistFieldName]
            verifyFieldFetch(field, testGlobalPicklist, Types.primitiveDataTypes.Picklist)
            expect(field.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME])
              .toEqual(new ReferenceExpression(
                new ElemID(
                  constants.SALESFORCE,
                  bpCase(GLOBAL_VALUE_SET),
                  'instance',
                  bpCase(gvsName),
                )
              ))
          })

          it('multipicklist', () => {
            verifyFieldFetch(
              fields[multiSelectPicklistFieldName],
              testMultiSelectPicklist,
              Types.primitiveDataTypes.MultiselectPicklist
            )
          })

          it('percent', () => {
            verifyFieldFetch(
              fields[percentFieldName],
              testPercent,
              Types.primitiveDataTypes.Percent
            )
          })

          it('phone', () => {
            verifyFieldFetch(fields[phoneFieldName], testPhone, Types.primitiveDataTypes.Phone)
          })

          it('long text area', () => {
            verifyFieldFetch(
              fields[longTextAreaFieldName],
              testLongTextArea,
              Types.primitiveDataTypes.LongTextArea
            )
          })

          it('rich text area', () => {
            verifyFieldFetch(
              fields[richTextAreaFieldName],
              testRichTextArea,
              Types.primitiveDataTypes.Html
            )
          })

          it('text area', () => {
            verifyFieldFetch(
              fields[textAreaFieldName],
              testTextArea,
              Types.primitiveDataTypes.TextArea
            )
          })

          it('encrypted text', () => {
            verifyFieldFetch(
              fields[encryptedTextFieldName],
              testEncryptedText,
              Types.primitiveDataTypes.EncryptedText
            )
          })

          it('url', () => {
            verifyFieldFetch(fields[urlFieldName], testUrl, Types.primitiveDataTypes.Url)
          })

          it('number', () => {
            verifyFieldFetch(fields[numberFieldName], testNumber, Types.primitiveDataTypes.Number)
          })

          it('text', () => {
            verifyFieldFetch(fields[textFieldName], testText, Types.primitiveDataTypes.Text)
          })

          it('checkbox', () => {
            verifyFieldFetch(
              fields[checkboxFieldName],
              testCheckbox,
              Types.primitiveDataTypes.Checkbox
            )
          })

          it('lookup', () => {
            const field = fields[lookupFieldName]
            verifyFieldFetch(field, testLookup, Types.primitiveDataTypes.Lookup)
            expect(field.annotations[constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION])
              .toBe(false)
          })

          it('master-detail', () => {
            verifyFieldFetch(
              fields[masterDetailFieldName],
              testMasterDetail,
              Types.primitiveDataTypes.MasterDetail,
            )
          })

          it('rollup summary', () => {
            const field = (findElements(result, 'Account') as ObjectType[])
              .find(a => a.fields[fetchedRollupSummaryFieldName])
              ?.fields[fetchedRollupSummaryFieldName] as Field
            verifyFieldFetch(field, testSummary, Types.primitiveDataTypes.Summary)
          })

          it('formula', () => {
            verifyFieldFetch(
              fields[formulaFieldName],
              testFormula,
              Types.formulaDataTypes[
                formulaTypeName(constants.FIELD_TYPE_NAMES.CHECKBOX)
              ]
            )
          })
        })
      })

      describe('add', () => {
        const customObjectName = 'TestAddFields__c'
        const testAddFieldPrefix = 'TestAdd'
        const mockElemID = new ElemID(constants.SALESFORCE, 'test add object with field types')
        let customFieldsObject: ObjectType
        let post: ObjectType
        let objectInfo: CustomObject

        beforeAll(async () => {
          customFieldsObject = findCustomFieldsObject(result, customObjectWithFieldsName)
          const newCustomObject = new ObjectType({
            elemID: mockElemID,
            fields: _(Object.values(customFieldsObject.fields))
              .map(field => {
                const name = [
                  masterDetailFieldName,
                  lookupFieldName,
                ].includes(field.name) ? `${testAddFieldPrefix}${field.name}` : field.name
                const newField = field.clone()
                newField.annotations[constants.API_NAME] = `${customObjectName}.${name}`

                if (name === multiSelectPicklistFieldName) {
                  newField.annotations[constants.VALUE_SET_DEFINITION_FIELDS.SORTED] = true
                }
                return [
                  name,
                  new Field(mockElemID, name, newField.type, newField.annotations, newField.isList),
                ]
              })
              .fromPairs()
              .value(),
            annotations: {
              [constants.API_NAME]: customObjectName,
              [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            },
          })

          // Resolve GVS valueSetName reference expression
          const normalizeGVSReference = (ref: ReferenceExpression): string | undefined => {
            const elem = findElement(result, ref.elemId)
            return elem ? apiName(elem) : undefined
          }
          Object.values(newCustomObject.fields)
            .filter(f => f.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]
              instanceof ReferenceExpression)
            .forEach(f => {
              f.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME] = normalizeGVSReference(
                f.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]
              )
            })

          if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
            await adapter.remove(newCustomObject)
          }
          post = await adapter.add(newCustomObject) as ObjectType
          objectInfo = (
            await client.readMetadata(constants.CUSTOM_OBJECT, customObjectName))[0] as CustomObject
        })

        it('custom object', async () => {
          expect(post).toBeDefined()
        })

        describe('fields', () => {
          let fields: Values
          const masterDetailApiName = `${testAddFieldPrefix}${masterDetailFieldName}`
          beforeAll(async () => {
            fields = _(makeArray(objectInfo.fields)
              .filter(f => f[INSTANCE_TYPE_FIELD]))
              .map(f => [
                f.fullName,
                Object.assign(
                  transformFieldAnnotations(f, objectInfo.fullName),
                  { [INSTANCE_TYPE_FIELD]: f[INSTANCE_TYPE_FIELD] }
                ),
              ])
              .fromPairs()
              .value()
          })

          const verifyFieldAddition = (field: Values,
            verificationFunc: (f: Values) => void,
            expectedType: string):
            void => {
            expect(field).toBeDefined()
            verificationFunc(field)
            expect(field[INSTANCE_TYPE_FIELD]).toEqual(expectedType)
          }

          it('currency', async () => {
            verifyFieldAddition(
              fields[currencyFieldName],
              testCurrency,
              constants.FIELD_TYPE_NAMES.CURRENCY
            )
          })

          it('autonumber', async () => {
            verifyFieldAddition(
              fields[autoNumberFieldName],
              testAutoNumber,
              constants.FIELD_TYPE_NAMES.AUTONUMBER
            )
          })

          it('date', () => {
            verifyFieldAddition(fields[dateFieldName], testDate, constants.FIELD_TYPE_NAMES.DATE)
          })

          it('time', () => {
            verifyFieldAddition(
              fields[timeFieldName],
              testTime,
              constants.FIELD_TYPE_NAMES.TIME
            )
          })

          it('datetime', () => {
            verifyFieldAddition(
              fields[dateTimeFieldName],
              testDatetime,
              constants.FIELD_TYPE_NAMES.DATETIME
            )
          })

          it('email', () => {
            verifyFieldAddition(fields[emailFieldName], testEmail, constants.FIELD_TYPE_NAMES.EMAIL)
          })

          it('location', () => {
            verifyFieldAddition(
              fields[locationFieldName],
              testLocation,
              constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
            )
          })

          it('picklist', () => {
            verifyFieldAddition(
              fields[picklistFieldName],
              testPicklist,
              constants.FIELD_TYPE_NAMES.PICKLIST
            )
          })

          it('multipicklist', () => {
            const testMultiSelectPicklistAdd = (annotations: Values): void =>
              testMultiSelectPicklist(annotations, true)
            verifyFieldAddition(
              fields[multiSelectPicklistFieldName],
              testMultiSelectPicklistAdd,
              constants.FIELD_TYPE_NAMES.MULTIPICKLIST
            )
          })

          it('global picklist', () => {
            const field = fields[globalPicklistFieldName]
            verifyFieldAddition(
              field,
              testGlobalPicklist,
              constants.FIELD_TYPE_NAMES.PICKLIST
            )
            expect(field[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(gvsName)
          })

          it('percent', () => {
            verifyFieldAddition(
              fields[percentFieldName],
              testPercent,
              constants.FIELD_TYPE_NAMES.PERCENT
            )
          })

          it('phone', () => {
            verifyFieldAddition(fields[phoneFieldName], testPhone, constants.FIELD_TYPE_NAMES.PHONE)
          })

          it('long text area', () => {
            verifyFieldAddition(
              fields[longTextAreaFieldName],
              testLongTextArea,
              constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
            )
          })

          it('rich text area', () => {
            verifyFieldAddition(
              fields[richTextAreaFieldName],
              testRichTextArea,
              constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
            )
          })

          it('text area', () => {
            verifyFieldAddition(
              fields[textAreaFieldName],
              testTextArea,
              constants.FIELD_TYPE_NAMES.TEXTAREA
            )
          })

          it('encrypted text', () => {
            verifyFieldAddition(
              fields[encryptedTextFieldName],
              testEncryptedText,
              constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
            )
          })

          it('url', () => {
            verifyFieldAddition(fields[urlFieldName], testUrl, constants.FIELD_TYPE_NAMES.URL)
          })

          it('number', () => {
            verifyFieldAddition(
              fields[numberFieldName],
              testNumber,
              constants.FIELD_TYPE_NAMES.NUMBER
            )
          })

          it('text', () => {
            verifyFieldAddition(fields[textFieldName], testText, constants.FIELD_TYPE_NAMES.TEXT)
          })

          it('checkbox', () => {
            verifyFieldAddition(
              fields[checkboxFieldName],
              testCheckbox,
              constants.FIELD_TYPE_NAMES.CHECKBOX
            )
          })

          it('lookup', () => {
            const fieldName = `${testAddFieldPrefix}${lookupFieldName}`
            verifyFieldAddition(fields[fieldName], testLookup, constants.FIELD_TYPE_NAMES.LOOKUP)
            expect(makeArray(objectInfo?.fields)
              .find(f => f.fullName === fieldName)?.deleteConstraint)
              .toEqual('Restrict')
          })

          it('master-detail', () => {
            verifyFieldAddition(
              fields[masterDetailApiName],
              testMasterDetail,
              constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
            )
          })

          it('rollup summary', async () => {
            const rollupSummaryFieldName = 'summary'
            const rollupSummaryFieldApiName = `${rollupSummaryFieldName}__c`

            const findCustomCase = (): ObjectType => {
              const caseObjects = findElements(result, 'Case') as ObjectType[]
              const customCase = caseObjects
                .filter(c => _.isUndefined(c.annotations[constants.API_NAME]))[0]
              const caseObject = customCase ?? caseObjects[0]
              // we add API_NAME annotation so the adapter will be
              //  able to construct the fields full name
              // upon update. in a real scenario, the case object is merged in the core and passed
              // to the adapter with the API_NAME annotation
              caseObject.annotations[constants.API_NAME] = 'Case'
              return caseObject
            }

            const normalizeReferences = (obj: ObjectType): void => {
              const resolveRef = (ref: ReferenceExpression): string | undefined => {
                const elem = findElement(result, ref.elemId)
                return elem ? apiName(elem) : undefined
              }
              Object.values(obj.fields)
                .map(field => field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
                .filter(fieldSecurity => fieldSecurity !== undefined)
                .forEach(fieldSecurity => {
                  Object.entries(fieldSecurity).forEach(([key, values]) => {
                    fieldSecurity[key] = (values as ReferenceExpression[]).map(resolveRef)
                  })
                })
            }

            let origCase = findCustomCase()
            normalizeReferences(origCase)

            const removeRollupSummaryFieldFromCase = async (caseObj: ObjectType, fieldName: string):
              Promise<ObjectType> => {
              const caseAfterFieldRemoval = caseObj.clone()
              delete caseAfterFieldRemoval.fields[fieldName]
              await adapter.update(caseObj, caseAfterFieldRemoval,
                [{ action: 'remove',
                  data: { before: caseObj.fields[fieldName] } }])
              return caseAfterFieldRemoval
            }
            if (await objectExists(constants.CUSTOM_OBJECT, 'Case', [rollupSummaryFieldApiName])) {
              origCase = await removeRollupSummaryFieldFromCase(origCase, rollupSummaryFieldApiName)
            }

            const addRollupSummaryField = async (): Promise<ObjectType> => {
              const caseAfterFieldAddition = origCase.clone()
              caseAfterFieldAddition.fields[rollupSummaryFieldName] = new Field(
                caseAfterFieldAddition.elemID,
                rollupSummaryFieldName,
                Types.primitiveDataTypes.Summary,
                {
                  [CORE_ANNOTATIONS.REQUIRED]: false,
                  [constants.LABEL]: 'Summary label',
                  [constants.API_NAME]: apiNameAnno('Case', rollupSummaryFieldApiName),
                  [constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: `${customObjectName}.${currencyFieldName}`,
                  [constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: `${customObjectName}.${masterDetailApiName}`,
                  [constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'max',
                  [constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [
                    {
                      [constants.FILTER_ITEM_FIELDS.FIELD]: `${customObjectName}.${currencyFieldName}`,
                      [constants.FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
                      [constants.FILTER_ITEM_FIELDS.VALUE]: '1',
                    },
                  ],
                }
              )
              await adapter.update(origCase, caseAfterFieldAddition,
                [{ action: 'add',
                  data: { after: caseAfterFieldAddition.fields[rollupSummaryFieldName] } }])
              return caseAfterFieldAddition
            }
            const verifyRollupSummaryField = async (): Promise<void> => {
              const fetchedRollupSummary = (await client.readMetadata(constants.CUSTOM_FIELD,
                `Case.${rollupSummaryFieldApiName}`))[0] as CustomField
              expect(_.get(fetchedRollupSummary, 'summarizedField'))
                .toEqual(`${customObjectName}.${currencyFieldName}`)
              expect(_.get(fetchedRollupSummary, 'summaryForeignKey'))
                .toEqual(`${customObjectName}.${masterDetailApiName}`)
              expect(_.get(fetchedRollupSummary, 'summaryOperation')).toEqual('max')
              expect(fetchedRollupSummary.summaryFilterItems).toBeDefined()
              const filterItems = fetchedRollupSummary.summaryFilterItems as FilterItem
              expect(filterItems.field).toEqual(`${customObjectName}.${currencyFieldName}`)
              expect(filterItems.operation).toEqual('greaterThan')
              expect(filterItems.value).toEqual('1')
            }

            const caseAfterFieldAddition = await addRollupSummaryField()
            await verifyRollupSummaryField()
            await removeRollupSummaryFieldFromCase(caseAfterFieldAddition, rollupSummaryFieldName)
          })

          it('formula', () => {
            verifyFieldAddition(
              fields[formulaFieldName],
              testFormula,
              constants.FIELD_TYPE_NAMES.CHECKBOX
            )
          })
        })
      })

      describe('update', () => {
        let objectInfo: CustomObject

        const adminFieldPermissions = {
          [FIELD_LEVEL_SECURITY_ANNOTATION]: {
            [constants.FIELD_LEVEL_SECURITY_FIELDS.READABLE]: [ADMIN],
            [constants.FIELD_LEVEL_SECURITY_FIELDS.EDITABLE]: [ADMIN],
          },
        }

        const fieldNamesToAnnotations: Record<string, Values> = {
          [currencyFieldName]: {
            [constants.LABEL]: 'Currency label Updated',
            [constants.DESCRIPTION]: 'Currency description Updated',
            [constants.HELP_TEXT]: 'Currency help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.SCALE]: 4,
            [constants.FIELD_ANNOTATIONS.PRECISION]: 17,
            [constants.DEFAULT_VALUE_FORMULA]: '24',
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.CURRENCY,
          },
          [autoNumberFieldName]: {
            [constants.LABEL]: 'AutoNumber label Updated',
            [constants.DESCRIPTION]: 'AutoNumber description Updated',
            [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'QQQ-{0000}',
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.AUTONUMBER,
          },
          [dateFieldName]: {
            [constants.LABEL]: 'Date label Updated',
            [constants.DESCRIPTION]: 'Date description Updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.DATE,
          },
          [timeFieldName]: {
            [constants.LABEL]: 'Time label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TIME,
            ...adminFieldPermissions,
          },
          [dateTimeFieldName]: {
            [constants.LABEL]: 'DateTime label Updated',
            [constants.DESCRIPTION]: 'DateTime description Updated',
            [constants.HELP_TEXT]: 'DateTime help updated',
            [constants.BUSINESS_STATUS]: 'Hidden',
            [constants.SECURITY_CLASSIFICATION]: 'Restricted',
            [constants.COMPLIANCE_GROUP]: 'GDPR',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.DATETIME,
            ...adminFieldPermissions,
          },
          [picklistFieldName]: {
            [constants.LABEL]: 'Picklist label Updated',
            [constants.DESCRIPTION]: 'Picklist description Updated',
            [constants.HELP_TEXT]: 'Picklist help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: false,
            [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
              {
                default: false,
                fullName: 'NEWER',
                label: 'NEWER',
                color: '#FFFF00',
              },
              {
                default: true,
                fullName: 'OLDER',
                label: 'OLDER',
                color: '#FFFFFF',
              },
            ],
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PICKLIST,
          },
          [multiSelectPicklistFieldName]: {
            [constants.LABEL]: 'Multipicklist label Updated',
            [constants.DESCRIPTION]: 'Multipicklist description Updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 6,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
            [constants.VALUE_SET_DEFINITION_FIELDS.SORTED]: true,
            [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
              {
                default: true,
                fullName: 'RE_UPDATED',
                label: 'RE_UPDATED',
                color: '#00000F',
              },
              {
                default: false,
                fullName: 'DO_UPDATED',
                label: 'DO_UPDATED',
                color: '#FFFFFF',
              },
            ],
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.MULTIPICKLIST,
          },
          [emailFieldName]: {
            [constants.LABEL]: 'Email label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.FIELD_ANNOTATIONS.UNIQUE]: false,
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.EMAIL,
            ...adminFieldPermissions,
          },
          [locationFieldName]: {
            [constants.LABEL]: 'Location label Updated',
            [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: false,
            [constants.FIELD_ANNOTATIONS.SCALE]: 10,
            [constants.BUSINESS_STATUS]: 'Active',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
          },
          [percentFieldName]: {
            [constants.LABEL]: 'Percent label Updated',
            [constants.DESCRIPTION]: 'Percent description Updated',
            [constants.HELP_TEXT]: 'Percent help updated',
            [constants.FIELD_ANNOTATIONS.SCALE]: 7,
            [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PERCENT,
            ...adminFieldPermissions,
          },
          [phoneFieldName]: {
            [constants.LABEL]: 'Phone label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PHONE,
            ...adminFieldPermissions,
          },
          [longTextAreaFieldName]: {
            [constants.LABEL]: 'LongTextArea label Updated',
            [constants.DESCRIPTION]: 'LongTextArea description Updated',
            [constants.FIELD_ANNOTATIONS.LENGTH]: 32000,
            [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
          },
          [richTextAreaFieldName]: {
            [constants.LABEL]: 'RichTextArea label Updated',
            [constants.HELP_TEXT]: 'RichTextArea help updated',
            [constants.FIELD_ANNOTATIONS.LENGTH]: 32000,
            [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 10,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
          },
          [textAreaFieldName]: {
            [constants.LABEL]: 'TextArea label Updated',
            [constants.DESCRIPTION]: 'TextArea description Updated',
            [constants.HELP_TEXT]: 'TextArea help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TEXTAREA,
          },
          [encryptedTextFieldName]: {
            [constants.LABEL]: 'EncryptedText label Updated',
            [constants.DESCRIPTION]: 'EncryptedText description Updated',
            [constants.HELP_TEXT]: 'EncryptedText help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.LENGTH]: 100,
            [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
            [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'ssn',
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
          },
          [urlFieldName]: {
            [constants.LABEL]: 'Url label Updated',
            [constants.DESCRIPTION]: 'Url description Updated',
            [constants.HELP_TEXT]: 'Url help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.URL,
          },
          [numberFieldName]: {
            [constants.LABEL]: 'Number label Updated',
            [constants.DESCRIPTION]: 'Number description Updated',
            [constants.HELP_TEXT]: 'Number help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.SCALE]: 6,
            [constants.FIELD_ANNOTATIONS.PRECISION]: 9,
            [constants.FIELD_ANNOTATIONS.UNIQUE]: false,
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.NUMBER,
          },
          [textFieldName]: {
            [constants.LABEL]: 'Text label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.FIELD_ANNOTATIONS.LENGTH]: 99,
            [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TEXT,
            ...adminFieldPermissions,
          },
          [checkboxFieldName]: {
            [constants.LABEL]: 'Checkbox label Updated',
            [constants.DESCRIPTION]: 'Checkbox description Updated',
            [constants.HELP_TEXT]: 'Checkbox help updated',
            [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.CHECKBOX,
            ...adminFieldPermissions,
          },
          [globalPicklistFieldName]: {
            [constants.LABEL]: 'GlobalPicklist label Updated',
            [constants.DESCRIPTION]: 'GlobalPicklist description Updated',
            [constants.HELP_TEXT]: 'GlobalPicklist help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
            [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: gvsName,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PICKLIST,
          },
          [lookupFieldName]: {
            [constants.LABEL]: 'Lookup label Updated',
            [constants.DESCRIPTION]: 'Lookup description Updated',
            [constants.HELP_TEXT]: 'Lookup help updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: true,
            [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Opportunity'],
            [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
              [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: false,
              [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1',
              [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'Updated error message',
              [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'Updated info message',
              [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
              [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
                [constants.FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.NextStep',
                [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                [constants.FILTER_ITEM_FIELDS.VALUE]: 'NextStepValueUpdated',
              }],
            },
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.LOOKUP,
            ...adminFieldPermissions,
          },
          [masterDetailFieldName]: {
            [constants.LABEL]: 'MasterDetail label Updated',
            [constants.DESCRIPTION]: 'MasterDetail description Updated',
            [constants.HELP_TEXT]: 'MasterDetail help updated',
            [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
            [constants.FIELD_ANNOTATIONS.RELATIONSHIP_NAME]: masterDetailFieldName
              .split(constants.SALESFORCE_CUSTOM_SUFFIX)[0],
            [constants.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: false,
            [constants.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: false,
            [constants.FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]: 0,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
          },
          [formulaFieldName]: {
            [constants.LABEL]: 'Formula label Updated',
            [constants.DESCRIPTION]: 'Formula description Updated',
            [constants.HELP_TEXT]: 'Formula help updated',
            [constants.FORMULA]: '3 > 9',
            [constants.BUSINESS_STATUS]: 'Active',
            [constants.SECURITY_CLASSIFICATION]: 'MissionCritical',
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.CHECKBOX,
          },
        }

        const updateAnnotations = (
          targetObject: ObjectType,
          srcObject: ObjectType,
          annotations: Record<string, Values>
        ): void => {
          Object.entries(annotations).forEach(([name, value]) => {
            targetObject.fields[name].annotations = Object.assign(
              value,
              { [constants.API_NAME]: srcObject.fields[name].annotations[constants.API_NAME] }
            )
          })
        }

        beforeAll(async () => {
          const customFieldsObject = findCustomFieldsObject(result, customObjectWithFieldsName)
          const newCustomObject = customFieldsObject.clone()
          updateAnnotations(newCustomObject, customFieldsObject, fieldNamesToAnnotations)
          await adapter.update(customFieldsObject,
            newCustomObject,
            Object.keys(fieldNamesToAnnotations)
              .map(f => ({
                action: 'modify',
                data: { before: customFieldsObject.fields[f], after: newCustomObject.fields[f] },
              })))
          objectInfo = (
            await client.readMetadata(
              constants.CUSTOM_OBJECT, customObjectWithFieldsName
            ))[0] as CustomObject
        })

        describe('fields', () => {
          let fields: Values
          beforeAll(async () => {
            fields = _(makeArray(objectInfo.fields)
              .filter(f => f[INSTANCE_TYPE_FIELD]))
              .map(f => [
                f.fullName,
                Object.assign(
                  transformFieldAnnotations(f, objectInfo.fullName),
                  { [INSTANCE_TYPE_FIELD]: f[INSTANCE_TYPE_FIELD] }
                ),
              ])
              .fromPairs()
              .value()
          })

          const verifyFieldUpdate = (
            name: string,
            expectedType: string,
            expectedAnnotations?: Values,
          ):
            void => {
            const field = fields[name]
            const annotations = expectedAnnotations ?? fieldNamesToAnnotations[name]
            expect(field[INSTANCE_TYPE_FIELD]).toEqual(expectedType)
            expect(field).toEqual(_.omit(annotations, FIELD_LEVEL_SECURITY_ANNOTATION))
          }

          it('currency', async () => {
            verifyFieldUpdate(currencyFieldName, constants.FIELD_TYPE_NAMES.CURRENCY)
          })

          it('autonumber', async () => {
            verifyFieldUpdate(autoNumberFieldName, constants.FIELD_TYPE_NAMES.AUTONUMBER)
          })

          it('date', async () => {
            verifyFieldUpdate(dateFieldName, constants.FIELD_TYPE_NAMES.DATE)
          })

          it('time', async () => {
            verifyFieldUpdate(timeFieldName, constants.FIELD_TYPE_NAMES.TIME)
          })

          it('dateTime', async () => {
            verifyFieldUpdate(dateTimeFieldName, constants.FIELD_TYPE_NAMES.DATETIME)
          })

          it('picklist', async () => {
            const annotations = fieldNamesToAnnotations[picklistFieldName]
            annotations[constants.VALUE_SET_DEFINITION_FIELDS.SORTED] = false
            verifyFieldUpdate(
              picklistFieldName,
              constants.FIELD_TYPE_NAMES.PICKLIST,
              annotations
            )
          })

          it('multipicklist', async () => {
            const annotations = fieldNamesToAnnotations[multiSelectPicklistFieldName]
            annotations[constants.VALUE_SET_DEFINITION_FIELDS.SORTED] = false
            annotations[constants.FIELD_ANNOTATIONS.VALUE_SET] = [
              annotations[constants.FIELD_ANNOTATIONS.VALUE_SET][1],
              annotations[constants.FIELD_ANNOTATIONS.VALUE_SET][0],
              {
                default: false,
                fullName: 'DO',
                isActive: false,
                label: 'DO',
              },
              {
                default: false,
                fullName: 'RE',
                isActive: false,
                label: 'RE',
              },
            ]
            verifyFieldUpdate(
              multiSelectPicklistFieldName,
              constants.FIELD_TYPE_NAMES.MULTIPICKLIST,
              annotations
            )
          })

          it('global picklist', async () => {
            verifyFieldUpdate(globalPicklistFieldName, constants.FIELD_TYPE_NAMES.PICKLIST)
          })

          it('email', async () => {
            verifyFieldUpdate(emailFieldName, constants.FIELD_TYPE_NAMES.EMAIL)
          })

          it('location', async () => {
            verifyFieldUpdate(locationFieldName, constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION)
          })

          it('percent', async () => {
            verifyFieldUpdate(percentFieldName, constants.FIELD_TYPE_NAMES.PERCENT)
          })

          it('phone', async () => {
            verifyFieldUpdate(phoneFieldName, constants.FIELD_TYPE_NAMES.PHONE)
          })

          it('long text area', async () => {
            verifyFieldUpdate(longTextAreaFieldName, constants.FIELD_TYPE_NAMES.LONGTEXTAREA)
          })

          it('rich text area', async () => {
            verifyFieldUpdate(richTextAreaFieldName, constants.FIELD_TYPE_NAMES.RICHTEXTAREA)
          })

          it('text area', async () => {
            verifyFieldUpdate(textAreaFieldName, constants.FIELD_TYPE_NAMES.TEXTAREA)
          })

          it('encrypted text', async () => {
            verifyFieldUpdate(encryptedTextFieldName, constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT)
          })

          it('url', async () => {
            verifyFieldUpdate(urlFieldName, constants.FIELD_TYPE_NAMES.URL)
          })

          it('number', async () => {
            verifyFieldUpdate(numberFieldName, constants.FIELD_TYPE_NAMES.NUMBER)
          })

          it('text', async () => {
            verifyFieldUpdate(textFieldName, constants.FIELD_TYPE_NAMES.TEXT)
          })

          it('checkbox', async () => {
            verifyFieldUpdate(checkboxFieldName, constants.FIELD_TYPE_NAMES.CHECKBOX)
          })

          it('formula', async () => {
            verifyFieldUpdate(formulaFieldName, constants.FIELD_TYPE_NAMES.CHECKBOX)
          })

          it('lookup', async () => {
            const annotations = fieldNamesToAnnotations[lookupFieldName]
            verifyFieldUpdate(
              lookupFieldName,
              constants.FIELD_TYPE_NAMES.LOOKUP,
              _.omit(annotations, constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION)
            )
            expect(makeArray(objectInfo?.fields)
              .find(f => f.fullName === lookupFieldName)?.deleteConstraint)
              .toEqual('SetNull')
          })

          it('master-detail', async () => {
            const annotations = fieldNamesToAnnotations[masterDetailFieldName]
            verifyFieldUpdate(
              masterDetailFieldName,
              constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
              _.omit(annotations, constants.FIELD_ANNOTATIONS.RELATIONSHIP_NAME)
            )
          })

          it('rollup summary', async () => {
            const fullName = `${accountApiName}.${fetchedRollupSummaryFieldName}`
            const annotations = {
              [constants.API_NAME]: fullName,
              [constants.LABEL]: 'Summary label Updated',
              [constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: 'Opportunity.TotalOpportunityQuantity',
              [constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [{
                [constants.FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.TotalOpportunityQuantity',
                [constants.FILTER_ITEM_FIELDS.OPERATION]: 'lessThan',
                [constants.FILTER_ITEM_FIELDS.VALUE]: '10',
              }],
              [constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: 'Opportunity.AccountId',
              [constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'min',
              [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.ROLLUP_SUMMARY,
              ...adminFieldPermissions,
            }
            const account = (findElements(result, 'Account') as ObjectType[])
              .find(a => a.fields[fetchedRollupSummaryFieldName]) as ObjectType
            expect(account).toBeDefined()
            const field = account.fields[fetchedRollupSummaryFieldName]
            const updatedField = field.clone()
            updatedField.annotations = annotations
            const updatedAccount = account.clone()
            updatedAccount.fields[fetchedRollupSummaryFieldName] = updatedField
            await adapter.update(
              account,
              updatedAccount,
              [{ action: 'modify', data: { before: field, after: updatedField } }],
            )
            const fieldInfo = (
              await client.readMetadata(constants.CUSTOM_FIELD, fullName)
            )[0] as CustomField
            expect(fieldInfo[constants.INSTANCE_FULL_NAME_FIELD])
              .toEqual(`${accountApiName}.${fetchedRollupSummaryFieldName}`)
            delete fieldInfo[constants.INSTANCE_FULL_NAME_FIELD]
            expect(Object.assign(
              transformFieldAnnotations(fieldInfo, accountApiName),
              { [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.ROLLUP_SUMMARY }
            )).toEqual(_.omit(annotations, [FIELD_LEVEL_SECURITY_ANNOTATION, constants.API_NAME]))
          })
        })
      })
    })

    it('should add lookupFilter to an existing lookup field', async () => {
      const customObjectName = 'TestAddLookupFilter__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add lookupFilter')
      const fieldName = `lookup${String(Date.now()).substring(6)}`
      const lookupFieldApiName = `${_.camelCase(fieldName)}__c`
      const lookupFieldApiFullName = [
        customObjectName,
        lookupFieldApiName,
      ].join(constants.API_NAME_SEPERATOR)
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {},
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      oldElement.fields[fieldName] = new Field(
        mockElemID,
        fieldName,
        Types.primitiveDataTypes.Lookup,
        {
          [constants.API_NAME]: lookupFieldApiFullName,
          [constants.LABEL]: fieldName,
          [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
          [FIELD_LEVEL_SECURITY_ANNOTATION]: {
            editable: [ADMIN],
            readable: [ADMIN],
          },
        },
      )
      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, [lookupFieldApiName]))
        .toBe(true)

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      newElement.fields[fieldName] = new Field(
        mockElemID,
        fieldName,
        Types.primitiveDataTypes.Lookup,
        {
          [constants.API_NAME]: lookupFieldApiFullName,
          [constants.LABEL]: fieldName,
          [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
          [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
            [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'Info message',
            [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: true,
            [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [
              { [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
                [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id' },
            ],
          },
          [FIELD_LEVEL_SECURITY_ANNOTATION]: {
            editable: [ADMIN],
            readable: [ADMIN],
          },
        },
      )

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [{ action: 'modify',
          data: { before: oldElement.fields[fieldName],
            after: newElement.fields[fieldName] } }])
      expect(modificationResult).toBeInstanceOf(ObjectType)

      // Verify the lookup filter was created
      const customObject = await client.describeSObjects([customObjectName])
      expect(customObject[0]).toBeDefined()
      const lookupField = customObject[0].fields
        .filter(field => field.name === lookupFieldApiName)[0]
      expect(lookupField).toBeDefined()
      expect(lookupField.filteredLookupInfo).toBeDefined()

      // Clean-up
      await adapter.remove(oldElement)
    })

    it('should add default TopicsForObjects values', async () => {
      const customObjectName = 'TestAddDefaultTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add default topic for objects')
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {},
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const addResult = await adapter.add(element)
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(addResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(false)
    })

    it('should add element TopicsForObjects value', async () => {
      const customObjectName = 'TestAddElementTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add element topic for objects')
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {},
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.TOPICS_FOR_OBJECTS_ANNOTATION]: { [constants
            .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]: true },
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const addResult = await adapter.add(element)
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(addResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(true)

      // Checks if the new topic' object exists
      const results = (await client.readMetadata(constants.TOPICS_FOR_OBJECTS_METADATA_TYPE,
        apiName(addResult))) as TopicsForObjectsInfo[]
      expect(results).toHaveLength(1)
      expect(results[0].enableTopics).toBe('true')
    })

    it('should update TopicsForObjects field', async () => {
      const customObjectName = 'TestUpdateTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add topic for objects')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {},
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(oldElement)
      }
      const addResult = await adapter.add(oldElement)
      // Verify setup was performed properly
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBe(true)
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(addResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(false)

      const newElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.TOPICS_FOR_OBJECTS_ANNOTATION]:
          { [constants.TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]: true },
        },
      })

      // Test
      const modificationResult = await adapter.update(oldElement, newElement,
        [{ action: 'modify', data: { before: oldElement, after: newElement } }])

      // Verify the enable topics was changed correctly
      expect(modificationResult).toBeInstanceOf(ObjectType)
      expect(modificationResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(true)

      // Clean-up
      await adapter.remove(oldElement)
    })

    // Assignment rules are special because they use the Deploy API so they get their own test
    describe('assignment rules manipulation', () => {
      const assignmentRulesTypeName = 'AssignmentRules'
      const getRulesFromClient = async (): Promise<Values> => fromMetadataInfo(
        (await client.readMetadata(assignmentRulesTypeName, 'Lead'))[0]
      )

      let before: InstanceElement
      let after: InstanceElement
      let validAssignment: Values

      beforeAll(async () => {
        // Make sure our test rule does not exist before we start
        const assignmentRulesType = result
          .filter(isObjectType)
          .find(e => metadataType(e) === assignmentRulesTypeName) as ObjectType

        const leadAssignmentRule = result
          .filter(e => metadataType(e) === assignmentRulesTypeName)
          .filter(isInstanceElement)
          .find(e => e.value[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead') as InstanceElement

        if (makeArray(leadAssignmentRule.value.assignmentRule)
          .find(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] === 'NonStandard')) {
          await client.delete('AssignmentRule', 'Lead.NonStandard').catch(() => undefined)
        }

        before = new InstanceElement(
          'LeadAssignmentRules',
          assignmentRulesType,
          await getRulesFromClient(),
        )
        validAssignment = _.omit(
          _.flatten([_.flatten([before.value.assignmentRule])[0].ruleEntry]).pop(),
          'criteriaItems'
        )
      })

      beforeEach(async () => {
        after = new InstanceElement(
          before.elemID.name,
          before.type,
          _.cloneDeep(before.value),
        )
      })

      it('should create rule', async () => {
        after.value.assignmentRule = _.flatten([
          after.value.assignmentRule,
          {
            [constants.INSTANCE_FULL_NAME_FIELD]: 'NonStandard',
            active: 'false',
            ruleEntry: _.merge({}, validAssignment, {
              criteriaItems: {
                field: 'Lead.City',
                operation: 'equals',
                value: 'Here',
              },
            }),
          },
        ])

        await adapter.update(before, after, [])

        const updatedRules = await getRulesFromClient()
        // Since assignment rules order is not relevant so we have to compare sets
        expect(new Set(updatedRules.assignmentRule)).toEqual(new Set(after.value.assignmentRule))

        await adapter.update(after, before, [{ action: 'modify', data: { before: after, after: before } }])
        const rules = await getRulesFromClient()
        expect(new Set(makeArray(rules.assignmentRule)))
          .toEqual(new Set(makeArray(before.value.assignmentRule)))
      })

      it('should update existing', async () => {
        const rule = _.flatten([after.value.assignmentRule])[0]
        rule.ruleEntry = _.flatten([rule.ruleEntry])
        rule.ruleEntry.push(_.merge({}, validAssignment, {
          assignedTo: validAssignment.assignedTo,
          assignedToType: validAssignment.assignedToType,
          criteriaItems: [
            {
              field: 'Lead.City',
              operation: 'startsWith',
              value: 'A',
            },
            {
              field: 'Lead.Country',
              operation: 'startsWith',
              value: 'B',
            },
          ],
        }))
        _.flatten([rule.ruleEntry[0].criteriaItems])[0].value = 'bla'

        await adapter.update(before, after, [])

        const updatedRules = await getRulesFromClient()
        expect(updatedRules).toEqual(after.value)
        await adapter.update(after, before, [])
      })
    })

    describe('deploy retrieve manipulations', () => {
      describe('types that support only retrieve & deploy', () => {
        const retrieve = async (type: string): Promise<RetrieveResult> => {
          const retrieveRequest = {
            apiVersion: API_VERSION,
            singlePackage: false,
            unpackaged: [{ types: { name: type, members: '*' } }],
          }
          return client.retrieve(retrieveRequest)
        }

        const findInstance = async (instance: InstanceElement):
          Promise<MetadataInfo | undefined> => {
          const type = metadataType(instance)
          const retrieveResult = await retrieve(type)
          const instanceInfos = (await fromRetrieveResult(retrieveResult, [type]))[type]
          return instanceInfos.find(info => info.fullName === apiName(instance))
        }

        const removeIfAlreadyExists = async (instance: InstanceElement): Promise<void> => {
          if (await findInstance(instance)) {
            await client.deploy(await toMetadataPackageZip(apiName(instance),
              metadataType(instance), instance.value, true) as Buffer)
          }
        }

        const verifyCreateInstance = async (instance: InstanceElement): Promise<void> => {
          await adapter.add(instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
          expect(_.get(instanceInfo, 'content').includes('Created')).toBeTruthy()
        }

        const verifyUpdateInstance = async (instance: InstanceElement): Promise<void> => {
          const after = instance.clone()
          after.value.content = after.value.content.replace('Created', 'Updated')
          await adapter.update(instance, after, [])
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
          expect(_.get(instanceInfo, 'content').includes('Updated')).toBeTruthy()
        }

        const verifyRemoveInstance = async (instance: InstanceElement): Promise<void> => {
          await adapter.remove(instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeUndefined()
        }

        const createInstanceElement = (fullName: string, typeName: string, content: string):
          InstanceElement => {
          const objectType = new ObjectType({
            elemID: new ElemID(constants.SALESFORCE, _.snakeCase(typeName)),
            annotations: {
              [constants.METADATA_TYPE]: typeName,
            },
          })
          return new InstanceElement(
            _.snakeCase(fullName),
            objectType,
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
              apiVersion: API_VERSION,
              content,
            }
          )
        }

        describe('apex class manipulation', () => {
          const apexClassInstance = createInstanceElement('MyApexClass', 'ApexClass',
            'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')

          beforeAll(async () => {
            await removeIfAlreadyExists(apexClassInstance)
          })

          describe('create apex class instance', () => {
            it('should create apex class instance', async () => {
              await verifyCreateInstance(apexClassInstance)
            })
          })

          describe('update apex class instance', () => {
            it('should update apex class instance', async () => {
              await verifyUpdateInstance(apexClassInstance)
            })
          })

          describe('remove apex class instance', () => {
            it('should remove apex class instance', async () => {
              await verifyRemoveInstance(apexClassInstance)
            })
          })
        })

        describe('apex trigger manipulation', () => {
          const apexTriggerInstance = createInstanceElement('MyApexTrigger', 'ApexTrigger',
            'trigger MyApexTrigger on Account (before insert) {\n    System.debug(\'Created\');\n}')

          beforeAll(async () => {
            await removeIfAlreadyExists(apexTriggerInstance)
          })

          describe('create apex trigger instance', () => {
            it('should create apex trigger instance', async () => {
              await verifyCreateInstance(apexTriggerInstance)
            })
          })

          describe('update apex trigger instance', () => {
            it('should update apex trigger instance', async () => {
              await verifyUpdateInstance(apexTriggerInstance)
            })
          })

          describe('remove apex trigger instance', () => {
            it('should remove apex trigger instance', async () => {
              await verifyRemoveInstance(apexTriggerInstance)
            })
          })
        })

        describe('apex page manipulation', () => {
          const apexPageInstance = createInstanceElement('MyApexPage', 'ApexPage',
            '<apex:page>Created by e2e test!</apex:page>')
          apexPageInstance.value.label = 'MyApexPage'

          beforeAll(async () => {
            await removeIfAlreadyExists(apexPageInstance)
          })

          describe('create apex page instance', () => {
            it('should create apex page instance', async () => {
              await verifyCreateInstance(apexPageInstance)
            })
          })

          describe('update apex page instance', () => {
            it('should update apex page instance', async () => {
              await verifyUpdateInstance(apexPageInstance)
            })
          })

          describe('remove apex page instance', () => {
            it('should remove apex page instance', async () => {
              await verifyRemoveInstance(apexPageInstance)
            })
          })
        })

        describe('apex component manipulation', () => {
          const apexComponentInstance = createInstanceElement('MyApexComponent', 'ApexComponent',
            '<apex:component >Created by e2e test!</apex:component>')
          apexComponentInstance.value.label = 'MyApexComponent'

          beforeAll(async () => {
            await removeIfAlreadyExists(apexComponentInstance)
          })

          describe('create apex component instance', () => {
            it('should create apex component instance', async () => {
              await verifyCreateInstance(apexComponentInstance)
            })
          })

          describe('update apex component instance', () => {
            it('should update apex component instance', async () => {
              await verifyUpdateInstance(apexComponentInstance)
            })
          })

          describe('remove apex component instance', () => {
            it('should remove apex component instance', async () => {
              await verifyRemoveInstance(apexComponentInstance)
            })
          })
        })
      })

      describe('types that support also CRUD-Based calls', () => {
        const findInstance = async (instance: InstanceElement):
          Promise<MetadataInfo | undefined> => {
          const instanceInfo = (await client.readMetadata(
            instance.type.annotations[constants.METADATA_TYPE],
            instance.value[constants.INSTANCE_FULL_NAME_FIELD],
          ))[0]
          if (instanceInfo && instanceInfo.fullName) {
            return instanceInfo
          }
          return undefined
        }

        const removeIfAlreadyExists = async (instance: InstanceElement): Promise<void> => {
          if (await findInstance(instance)) {
            await client.delete(instance.type.annotations[constants.METADATA_TYPE],
              instance.value[constants.INSTANCE_FULL_NAME_FIELD])
          }
        }

        const verifyCreateInstance = async (instance: InstanceElement): Promise<void> => {
          await adapter.add(instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
        }

        const verifyUpdateInstance = async (instance: InstanceElement, updatedField: string,
          updatedValue: string): Promise<void> => {
          const after = instance.clone()
          after.value[updatedField] = updatedValue
          await adapter.update(instance, after, [])
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
          expect(_.get(instanceInfo, updatedField)).toEqual(updatedValue)
        }

        const verifyRemoveInstance = async (instance: InstanceElement): Promise<void> => {
          await adapter.remove(instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeUndefined()
        }

        const createInstanceElement = (fullName: string, typeName: string, values: Values):
          InstanceElement => {
          const objectType = new ObjectType({
            elemID: new ElemID(constants.SALESFORCE, _.snakeCase(typeName)),
            annotations: {
              [constants.METADATA_TYPE]: typeName,
            },
          })
          return new InstanceElement(
            _.snakeCase(fullName),
            objectType,
            {
              ...values,
              [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
            }
          )
        }

        describe('email folder manipulation', () => {
          const emailFolderInstance = createInstanceElement('MyEmailFolder', 'EmailFolder',
            { name: 'My Email Folder Name' })

          beforeAll(async () => {
            await removeIfAlreadyExists(emailFolderInstance)
          })

          describe('create email folder instance', () => {
            it('should create email folder instance', async () => {
              await verifyCreateInstance(emailFolderInstance)
            })
          })

          describe('update email folder instance', () => {
            it('should update email folder instance', async () => {
              await verifyUpdateInstance(emailFolderInstance, 'name',
                'My Updated Email Folder Name')
            })
          })

          describe('remove email folder instance', () => {
            it('should remove email folder instance', async () => {
              await verifyRemoveInstance(emailFolderInstance)
            })
          })
        })

        describe('email template manipulation', () => {
          const emailTemplateInstance = createInstanceElement('TestEmailFolder/MyEmailTemplate',
            'EmailTemplate', {
              name: 'My Email Template Name',
              available: true,
              style: 'none',
              subject: 'My Email Template Subject',
              uiType: 'Aloha',
              encodingKey: 'UTF-8',
              type: 'text',
              description: 'My Email Template Description',
              content: 'My Email Template Body',
            })

          beforeAll(async () => {
            await removeIfAlreadyExists(emailTemplateInstance)
          })

          describe('create email template instance', () => {
            it('should create email template instance', async () => {
              await verifyCreateInstance(emailTemplateInstance)
            })
          })

          describe('update email template instance', () => {
            it('should update email template instance', async () => {
              await verifyUpdateInstance(emailTemplateInstance, 'name',
                'My Updated Email Template Name')
            })
          })

          describe('remove email template instance', () => {
            it('should remove email template instance', async () => {
              await verifyRemoveInstance(emailTemplateInstance)
            })
          })
        })

        describe('report type manipulation', () => {
          const reportTypeInstance = createInstanceElement('MyReportType',
            'ReportType', {
              label: 'My Report Type Label',
              baseObject: 'Account',
              category: 'accounts',
              deployed: true,
              sections: [{
                columns: [],
                masterLabel: 'Master Label',
              }],
            })

          beforeAll(async () => {
            await removeIfAlreadyExists(reportTypeInstance)
          })

          describe('create report type instance', () => {
            it('should create report type instance', async () => {
              await verifyCreateInstance(reportTypeInstance)
            })
          })

          describe('update report type instance', () => {
            it('should update report type instance', async () => {
              await verifyUpdateInstance(reportTypeInstance, 'label',
                'My Updated Report Type Label')
            })
          })

          describe('remove report type instance', () => {
            it('should remove report type instance', async () => {
              await verifyRemoveInstance(reportTypeInstance)
            })
          })
        })

        describe('report folder manipulation', () => {
          const reportFolderInstance = createInstanceElement('MyReportFolder', 'ReportFolder',
            { name: 'My Report Folder Name' })

          beforeAll(async () => {
            await removeIfAlreadyExists(reportFolderInstance)
          })

          describe('create report folder instance', () => {
            it('should create report folder instance', async () => {
              await verifyCreateInstance(reportFolderInstance)
            })
          })

          describe('update report folder instance', () => {
            it('should update report folder instance', async () => {
              await verifyUpdateInstance(reportFolderInstance, 'name',
                'My Updated Report Folder Name')
            })
          })

          describe('remove report folder instance', () => {
            it('should remove report folder instance', async () => {
              await verifyRemoveInstance(reportFolderInstance)
            })
          })
        })

        describe('report manipulation', () => {
          const reportInstance = createInstanceElement('TestReportFolder/MyReport',
            'Report', {
              name: 'My Report Name',
              format: 'Summary',
              reportType: 'Opportunity',
            })

          beforeAll(async () => {
            await removeIfAlreadyExists(reportInstance)
          })

          describe('create report instance', () => {
            it('should create report instance', async () => {
              await verifyCreateInstance(reportInstance)
            })
          })

          describe('update report instance', () => {
            it('should update report instance', async () => {
              await verifyUpdateInstance(reportInstance, 'name',
                'My Updated Report Name')
            })
          })

          describe('remove report instance', () => {
            it('should remove report instance', async () => {
              await verifyRemoveInstance(reportInstance)
            })
          })
        })

        describe('dashboard folder manipulation', () => {
          const dashboardFolderInstance = createInstanceElement('MyDashboardFolder', 'DashboardFolder',
            { name: 'My Dashboard Folder Name' })

          beforeAll(async () => {
            await removeIfAlreadyExists(dashboardFolderInstance)
          })

          describe('create dashboard folder instance', () => {
            it('should create dashboard folder instance', async () => {
              await verifyCreateInstance(dashboardFolderInstance)
            })
          })

          describe('update dashboard folder instance', () => {
            it('should update dashboard folder instance', async () => {
              await verifyUpdateInstance(dashboardFolderInstance, 'name',
                'My Updated Dashboard Folder Name')
            })
          })

          describe('remove dashboard folder instance', () => {
            it('should remove dashboard folder instance', async () => {
              await verifyRemoveInstance(dashboardFolderInstance)
            })
          })
        })

        describe('dashboard manipulation', () => {
          const dashboardInstance = createInstanceElement('TestDashboardFolder/MyDashboard',
            'Dashboard', {
              backgroundEndColor: '#FFFFFF',
              backgroundFadeDirection: 'Diagonal',
              backgroundStartColor: '#FFFFFF',
              textColor: '#000000',
              title: 'My Dashboard Title',
              titleColor: '#000000',
              titleSize: '12',
              leftSection: {
                columnSize: 'Medium',
                components: [],
              },
              rightSection: {
                columnSize: 'Medium',
                components: [],
              },
            })

          beforeAll(async () => {
            await removeIfAlreadyExists(dashboardInstance)
          })

          describe('create dashboard instance', () => {
            it('should create dashboard instance', async () => {
              await verifyCreateInstance(dashboardInstance)
            })
          })

          describe('update dashboard instance', () => {
            it('should update dashboard instance', async () => {
              await verifyUpdateInstance(dashboardInstance, 'title',
                'My Updated Dashboard Title')
            })
          })

          describe('remove dashboard instance', () => {
            it('should remove dashboard instance', async () => {
              await verifyRemoveInstance(dashboardInstance)
            })
          })
        })
      })
    })

    describe('flow instance manipulations', () => {
      let flow: InstanceElement
      beforeAll(async () => {
        const flowType = findObjectType(result, new ElemID(constants.SALESFORCE, 'Flow')) as ObjectType
        flow = new InstanceElement('MyFlow', flowType, {
          [constants.INSTANCE_FULL_NAME_FIELD]: 'MyFlow',
          decisions: {
            processMetadataValues: {
              name: 'index',
              value: {
                numberValue: '0.0',
              },
            },
            name: 'myDecision',
            label: 'myDecision2',
            locationX: '50',
            locationY: '0',
            defaultConnectorLabel: 'default',
            rules: {
              name: 'myRule_1',
              conditionLogic: 'and',
              conditions: {
                processMetadataValues: [
                  {
                    name: 'inputDataType',
                    value: {
                      stringValue: 'String',
                    },
                  },
                  {
                    name: 'leftHandSideType',
                    value: {
                      stringValue: 'String',
                    },
                  },
                  {
                    name: 'operatorDataType',
                    value: {
                      stringValue: 'String',
                    },
                  },
                  {
                    name: 'rightHandSideType',
                    value: {
                      stringValue: 'String',
                    },
                  },
                ],
                leftValueReference: 'myVariable_current.FirstName',
                operator: 'EqualTo',
                rightValue: {
                  stringValue: 'BLA',
                },
              },
              connector: {
                targetReference: 'myRule_1_A1',
              },
              label: 'NameIsBla',
            },
          },
          interviewLabel: 'MyFlow-1_InterviewLabel',
          label: 'MyFlow',
          processMetadataValues: [
            {
              name: 'ObjectType',
              value: {
                stringValue: 'Contact',
              },
            },
            {
              name: 'ObjectVariable',
              value: {
                elementReference: 'myVariable_current',
              },
            },
            {
              name: 'OldObjectVariable',
              value: {
                elementReference: 'myVariable_old',
              },
            },
            {
              name: 'TriggerType',
              value: {
                stringValue: 'onCreateOnly',
              },
            },
          ],
          processType: 'Workflow',
          recordUpdates: {
            processMetadataValues: [
              {
                name: 'evaluationType',
                value: {
                  stringValue: 'always',
                },
              },
              {
                name: 'extraTypeInfo',
              },
              {
                name: 'isChildRelationship',
                value: {
                  booleanValue: 'false',
                },
              },
              {
                name: 'reference',
                value: {
                  stringValue: '[Contact]',
                },
              },
              {
                name: 'referenceTargetField',
              },
            ],
            name: 'myRule_1_A1',
            label: 'UpdateLastName',
            locationX: '100',
            locationY: '200',
            filters: {
              processMetadataValues: {
                name: 'implicit',
                value: {
                  booleanValue: 'true',
                },
              },
              field: 'Id',
              operator: 'EqualTo',
              value: {
                elementReference: 'myVariable_current.Id',
              },
            },
            inputAssignments: {
              processMetadataValues: [
                {
                  name: 'dataType',
                  value: {
                    stringValue: 'String',
                  },
                },
                {
                  name: 'isRequired',
                  value: {
                    booleanValue: 'false',
                  },
                },
                {
                  name: 'leftHandSideLabel',
                  value: {
                    stringValue: 'Last Name',
                  },
                },
                {
                  name: 'leftHandSideReferenceTo',
                },
                {
                  name: 'rightHandSideType',
                  value: {
                    stringValue: 'String',
                  },
                },
              ],
              field: 'LastName',
              value: {
                stringValue: 'Updated Name',
              },
            },
            object: 'Contact',
          },
          startElementReference: 'myDecision',
          status: 'Draft',
          variables: [
            {
              name: 'myVariable_current',
              dataType: 'SObject',
              isCollection: 'false',
              isInput: 'true',
              isOutput: 'true',
              objectType: 'Contact',
            },
            {
              name: 'myVariable_old',
              dataType: 'SObject',
              isCollection: 'false',
              isInput: 'true',
              isOutput: 'false',
              objectType: 'Contact',
            },
          ],
        })

        // make sure we create a new flow and don't use an old one
        await adapter.remove(flow).catch(() => undefined)
      })

      describe('create flow', () => {
        it('should create flow', async () => {
          flow = (await adapter.add(flow)) as InstanceElement
          const flowInfo = (await client.readMetadata('Flow', 'MyFlow'))[0]
          expect(flowInfo).toBeDefined()
          expect(flowInfo[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyFlow')
          expect(_.get(flowInfo, 'variables')[0].dataType).toEqual('SObject')
        })
      })

      describe('update flow', () => {
        it('should update flow', async () => {
          const newFlow = flow.clone()
          newFlow.value.decisions.rules.conditions.operator = 'NotEqualTo'

          flow = (await adapter.update(flow, newFlow,
            [{ action: 'modify', data: { before: flow, after: newFlow } }])) as InstanceElement

          const flowInfo = (await client.readMetadata('Flow', 'MyFlow'))[0]
          expect(flowInfo).toBeDefined()
          expect(flowInfo[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyFlow')
          expect(_.get(flowInfo, 'decisions').rules.conditions.operator).toEqual('NotEqualTo')
        })
      })

      describe('delete flow', () => {
        it('should delete flow', async () => {
          await adapter.remove(flow)
          expect(await objectExists('Flow', 'MyFlow')).toBeFalsy()
        })
      })
    })

    describe('workflow instance manipulations', () => {
      const findInstance = async (type: string, fullName: string):
        Promise<MetadataInfo | undefined> => {
        const instanceInfo = (await client.readMetadata(type, fullName))[0]
        if (instanceInfo && instanceInfo.fullName) {
          return instanceInfo
        }
        return undefined
      }

      const removeIfAlreadyExists = async (type: string, fullName: string): Promise<void> => {
        if (await objectExists(type, fullName)) {
          await client.delete(type, fullName)
        }
      }

      describe('workflow alerts manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('WorkflowAlert', 'Lead.MyWorkflowAlert')
        })

        describe('create workflow alert', () => {
          it('should create workflow alert', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_ALERTS_FIELD] = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyWorkflowAlert',
              description: 'My Workflow Alert',
              protected: false,
              recipients: [
                {
                  recipient: 'CEO',
                  type: 'role',
                },
              ],
              senderType: 'CurrentUser',
              template: 'unfiled$public/SalesNewCustomerEmail',
            }, ...makeArray(newWorkflow.value[WORKFLOW_ALERTS_FIELD])]

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowAlert', 'Lead.MyWorkflowAlert')).toBeTruthy()
            // to save another fetch, we set the new workflow alert on the old instance
            oldWorkflow.value[WORKFLOW_ALERTS_FIELD] = newWorkflow.value[WORKFLOW_ALERTS_FIELD]
          })
        })

        describe('update workflow alert', () => {
          it('should update workflow alert', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            const workflowAlertToUpdate = makeArray(newWorkflow.value[WORKFLOW_ALERTS_FIELD])
              .find(alert => alert[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyWorkflowAlert')
            expect(workflowAlertToUpdate).toBeDefined()
            workflowAlertToUpdate.description = 'My Updated Workflow Alert'
            workflowAlertToUpdate.recipients = [
              {
                recipient: 'CEO',
                type: 'role',
              },
              {
                recipient: 'CFO',
                type: 'role',
              },
            ]
            workflowAlertToUpdate.template = 'unfiled$public/SupportCaseResponse'

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            const workflowAlertInfo = await findInstance('WorkflowAlert', 'Lead.MyWorkflowAlert')
            expect(workflowAlertInfo).toBeDefined()
            expect(_.get(workflowAlertInfo, 'description')).toEqual('My Updated Workflow Alert')
            expect(_.get(workflowAlertInfo, 'recipients')).toEqual([
              {
                recipient: 'CEO',
                type: 'role',
              },
              {
                recipient: 'CFO',
                type: 'role',
              },
            ])
            expect(_.get(workflowAlertInfo, 'template'))
              .toEqual('unfiled$public/SupportCaseResponse')
          })
        })

        describe('delete workflow alert', () => {
          it('should delete workflow alert', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_ALERTS_FIELD] = makeArray(
              newWorkflow.value[WORKFLOW_ALERTS_FIELD]
            ).filter(alert => alert[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyWorkflowAlert')

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowAlert', 'Lead.MyWorkflowAlert')).toBeFalsy()
          })
        })
      })

      describe('workflow field updates manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('WorkflowFieldUpdate', 'Lead.MyWorkflowFieldUpdate')
        })

        describe('create workflow field update', () => {
          it('should create workflow field update', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD] = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyWorkflowFieldUpdate',
              name: 'TestWorkflowFieldUpdate',
              description: 'My Workflow Field Update',
              field: 'Company',
              formula: 'LastName',
              notifyAssignee: false,
              reevaluateOnChange: true,
              protected: false,
              operation: 'Formula',
            }, ...makeArray(newWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD])]

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowFieldUpdate', 'Lead.MyWorkflowFieldUpdate'))
              .toBeTruthy()
            // to save another fetch, we set the new workflow field update on the old instance
            oldWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD] = newWorkflow
              .value[WORKFLOW_FIELD_UPDATES_FIELD]
          })
        })

        describe('update workflow field update', () => {
          it('should update workflow field update', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            const workflowFieldUpdateToUpdate = makeArray(
              newWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD]
            ).find(field =>
              field[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyWorkflowFieldUpdate')
            expect(workflowFieldUpdateToUpdate).toBeDefined()
            workflowFieldUpdateToUpdate.description = 'My Updated Workflow Field Update'
            workflowFieldUpdateToUpdate.field = 'Rating'
            workflowFieldUpdateToUpdate.operation = 'PreviousValue'
            workflowFieldUpdateToUpdate.reevaluateOnChange = false

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            const workflowFieldUpdateInfo = await findInstance('WorkflowFieldUpdate',
              'Lead.MyWorkflowFieldUpdate')
            expect(workflowFieldUpdateInfo).toBeDefined()
            expect(_.get(workflowFieldUpdateInfo, 'description'))
              .toEqual('My Updated Workflow Field Update')
            expect(_.get(workflowFieldUpdateInfo, 'field')).toEqual('Rating')
            expect(_.get(workflowFieldUpdateInfo, 'operation')).toEqual('PreviousValue')
            expect(_.get(workflowFieldUpdateInfo, 'reevaluateOnChange')).toBeUndefined()
          })
        })

        describe('delete workflow field update', () => {
          it('should delete workflow field update', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD] = makeArray(
              newWorkflow.value[WORKFLOW_FIELD_UPDATES_FIELD]
            ).filter(field =>
              field[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyWorkflowFieldUpdate')

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowFieldUpdate', 'Lead.MyWorkflowFieldUpdate')).toBeFalsy()
          })
        })
      })

      describe('workflow tasks manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('WorkflowTask', 'Lead.MyWorkflowTask')
        })

        describe('create workflow task', () => {
          it('should create workflow task', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_TASKS_FIELD] = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyWorkflowTask',
              assignedTo: 'CEO',
              assignedToType: 'role',
              description: 'My Workflow Task',
              dueDateOffset: 1,
              notifyAssignee: false,
              priority: 'Normal',
              protected: false,
              status: 'Not Started',
              subject: 'TestWorkflowOutboundMessage',
            }, ...makeArray(newWorkflow.value[WORKFLOW_TASKS_FIELD])]

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowTask', 'Lead.MyWorkflowTask')).toBeTruthy()
            // to save another fetch, we set the new workflow task on the old instance
            oldWorkflow.value[WORKFLOW_TASKS_FIELD] = newWorkflow.value[WORKFLOW_TASKS_FIELD]
          })
        })

        describe('update workflow task', () => {
          it('should update workflow task', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            const workflowTaskToUpdate = makeArray(newWorkflow.value[WORKFLOW_TASKS_FIELD])
              .find(task => task[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyWorkflowTask')
            expect(workflowTaskToUpdate).toBeDefined()
            workflowTaskToUpdate.description = 'My Updated Workflow Task'

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            const workflowTaskInfo = await findInstance('WorkflowTask', 'Lead.MyWorkflowTask')
            expect(workflowTaskInfo).toBeDefined()
            expect(_.get(workflowTaskInfo, 'description')).toEqual('My Updated Workflow Task')
          })
        })

        describe('delete workflow task', () => {
          it('should delete workflow task', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_TASKS_FIELD] = makeArray(
              newWorkflow.value[WORKFLOW_TASKS_FIELD]
            ).filter(task => task[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyWorkflowTask')

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowTask', 'Lead.MyWorkflowTask')).toBeFalsy()
          })
        })
      })

      describe('workflow rules manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('WorkflowRule', 'Lead.MyWorkflowRule')
        })

        describe('create workflow rule', () => {
          it('should create workflow rule', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_RULES_FIELD] = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyWorkflowRule',
              actions: [
                {
                  name: 'TestWorkflowAlert',
                  type: 'Alert',
                },
                {
                  name: 'TestWorkflowFieldUpdate',
                  type: 'FieldUpdate',
                },
                {
                  name: 'TestWorkflowTask',
                  type: 'Task',
                },
              ],
              active: false,
              criteriaItems: [
                {
                  field: 'Lead.Company',
                  operation: 'notEqual',
                  value: 'BLA',
                },
              ],
              description: 'My Workflow Rule',
              triggerType: 'onCreateOnly',
              workflowTimeTriggers: [
                {
                  actions: [
                    {
                      name: 'TestWorkflowAlert',
                      type: 'Alert',
                    },
                  ],
                  timeLength: '1',
                  workflowTimeTriggerUnit: 'Hours',
                },
              ],
            }, ...makeArray(newWorkflow.value[WORKFLOW_RULES_FIELD])]

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowRule', 'Lead.MyWorkflowRule')).toBeTruthy()
            // to save another fetch, we set the new workflow rule on the old instance
            oldWorkflow.value[WORKFLOW_RULES_FIELD] = newWorkflow.value[WORKFLOW_RULES_FIELD]
          })
        })

        describe('update workflow rule', () => {
          it('should update workflow rule', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            const workflowRuleToUpdate = makeArray(newWorkflow.value[WORKFLOW_RULES_FIELD])
              .find(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyWorkflowRule')
            expect(workflowRuleToUpdate).toBeDefined()
            workflowRuleToUpdate.description = 'My Updated Workflow Rule'
            workflowRuleToUpdate.criteriaItems = []
            workflowRuleToUpdate.formula = 'true'
            workflowRuleToUpdate.triggerType = 'onCreateOrTriggeringUpdate'
            workflowRuleToUpdate.workflowTimeTriggers = [
              {
                actions: [
                  {
                    name: 'TestWorkflowFieldUpdate',
                    type: 'FieldUpdate',
                  },
                ],
                timeLength: '2',
                workflowTimeTriggerUnit: 'Days',
              },
            ]

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            const workflowRuleInfo = await findInstance('WorkflowRule', 'Lead.MyWorkflowRule')
            expect(workflowRuleInfo).toBeDefined()
            expect(_.get(workflowRuleInfo, 'description')).toEqual('My Updated Workflow Rule')
            expect(_.get(workflowRuleInfo, 'criteriaItems')).toBeUndefined()
            expect(_.get(workflowRuleInfo, 'formula')).toEqual('true')
            expect(_.get(workflowRuleInfo, 'triggerType')).toEqual('onCreateOrTriggeringUpdate')
            const workflowTimeTrigger = _.get(workflowRuleInfo, 'workflowTimeTriggers')
            expect(workflowTimeTrigger.actions).toEqual({ name: 'TestWorkflowFieldUpdate',
              type: 'FieldUpdate' })
            expect(workflowTimeTrigger.timeLength).toEqual('2')
            expect(workflowTimeTrigger.workflowTimeTriggerUnit).toEqual('Days')
          })
        })

        describe('delete workflow rule', () => {
          it('should delete workflow rule', async () => {
            const oldWorkflow = findElements(result, constants.WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
            const newWorkflow = oldWorkflow.clone()
            newWorkflow.value[WORKFLOW_RULES_FIELD] = makeArray(
              newWorkflow.value[WORKFLOW_RULES_FIELD]
            ).filter(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyWorkflowRule')

            await adapter.update(oldWorkflow, newWorkflow,
              [{ action: 'modify', data: { before: oldWorkflow, after: newWorkflow } }])

            expect(await objectExists('WorkflowRule', 'Lead.MyWorkflowRule')).toBeFalsy()
          })
        })
      })

      it('should create and remove a workflow instance with inner types', async () => {
        const workflowInstanceName = 'Campaign'
        const workflowWithInnerTypes = new InstanceElement(workflowInstanceName,
          findElements(result, constants.WORKFLOW_METADATA_TYPE)[0] as ObjectType,
          {
            [constants.INSTANCE_FULL_NAME_FIELD]: workflowInstanceName,
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            [WORKFLOW_ALERTS_FIELD]: [
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(workflowInstanceName, 'MyWorkflowAlert1'),
                description: 'My Workflow Alert 1',
                protected: false,
                recipients: [
                  {
                    recipient: 'CEO',
                    type: 'role',
                  },
                ],
                senderType: 'CurrentUser',
                template: 'TestEmailFolder/TestEmailTemplate',
              },
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(workflowInstanceName, 'MyWorkflowAlert2'),
                description: 'My Workflow Alert 2',
                protected: false,
                recipients: [
                  {
                    recipient: 'CEO',
                    type: 'role',
                  },
                ],
                senderType: 'CurrentUser',
                template: 'TestEmailFolder/TestEmailTemplate',
              },
            ],
            [WORKFLOW_FIELD_UPDATES_FIELD]: {
              [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(workflowInstanceName, 'MyWorkflowFieldUpdate'),
              name: 'TestWorkflowFieldUpdate',
              description: 'My Workflow Field Update',
              field: 'Description',
              notifyAssignee: false,
              protected: false,
              operation: 'Null',
            },
            tasks: {
              [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(workflowInstanceName, 'MyWorkflowTask'),
              assignedTo: 'CEO',
              assignedToType: 'role',
              description: 'My Workflow Task',
              dueDateOffset: 1,
              notifyAssignee: false,
              priority: 'Normal',
              protected: false,
              status: 'Not Started',
              subject: 'TestWorkflowOutboundMessage',
            },
            rules: {
              [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(workflowInstanceName, 'MyWorkflowRule'),
              actions: [
                {
                  name: 'MyWorkflowAlert1',
                  type: 'Alert',
                },
                {
                  name: 'MyWorkflowAlert2',
                  type: 'Alert',
                },
                {
                  name: 'MyWorkflowFieldUpdate',
                  type: 'FieldUpdate',
                },
                {
                  name: 'MyWorkflowTask',
                  type: 'Task',
                },
              ],
              active: false,
              criteriaItems: [
                {
                  field: apiNameAnno(workflowInstanceName, 'Description'),
                  operation: 'notEqual',
                  value: 'BLA',
                },
              ],
              description: 'My Workflow Rule',
              triggerType: 'onCreateOnly',
              workflowTimeTriggers: [
                {
                  actions: [
                    {
                      name: 'MyWorkflowAlert1',
                      type: 'Alert',
                    },
                  ],
                  timeLength: '1',
                  workflowTimeTriggerUnit: 'Hours',
                },
              ],
            },
          })

        const innerTypesExist = async (): Promise<boolean[]> =>
          Promise.all([
            objectExists('WorkflowAlert', apiNameAnno(workflowInstanceName, 'MyWorkflowAlert1')),
            objectExists('WorkflowAlert', apiNameAnno(workflowInstanceName, 'MyWorkflowAlert2')),
            objectExists('WorkflowFieldUpdate', apiNameAnno(workflowInstanceName, 'MyWorkflowFieldUpdate')),
            objectExists('WorkflowTask', apiNameAnno(workflowInstanceName, 'MyWorkflowTask')),
            objectExists('WorkflowRule', apiNameAnno(workflowInstanceName, 'MyWorkflowRule')),
          ])

        if ((await innerTypesExist()).some(Boolean)) {
          await adapter.remove(workflowWithInnerTypes)
        }
        await adapter.add(workflowWithInnerTypes)
        expect((await innerTypesExist()).every(Boolean)).toBeTruthy()
        await adapter.remove(workflowWithInnerTypes)
        expect((await innerTypesExist()).some(Boolean)).toBeFalsy()
      })
    })

    describe('layout manipulations', () => {
      let layout: InstanceElement
      beforeAll(async () => {
        const layoutType = findObjectType(result, LAYOUT_TYPE_ID) as ObjectType
        layout = new InstanceElement('MyLayout', layoutType, {
          [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead-MyLayout',
          layoutSections: [
            {
              customLabel: false,
              detailHeading: false,
              editHeading: true,
              label: 'Lead Information',
              layoutColumns: [
                {
                  layoutItems: [
                    {
                      behavior: 'Required',
                      field: 'Name',
                    },
                    {
                      behavior: 'Required',
                      field: 'Company',
                    },
                  ],
                },
                {
                  layoutItems: [
                    {
                      behavior: 'Edit',
                      field: 'Email',
                    },
                    {
                      behavior: 'Required',
                      field: 'Status',
                    },
                    {
                      behavior: 'Edit',
                      field: 'Rating',
                    },
                  ],
                },
              ],
              style: 'TwoColumnsTopToBottom',
            },
            {
              customLabel: false,
              detailHeading: false,
              editHeading: true,
              label: 'Address Information',
              layoutColumns: [
                {
                  layoutItems: [
                    {
                      behavior: 'Edit',
                      field: 'Address',
                    },
                  ],
                },
              ],
              style: 'OneColumn',
            },
          ],
          quickActionList: {
            quickActionListItems: [
              {
                quickActionName: 'FeedItem.LinkPost',
              },
              {
                quickActionName: 'FeedItem.PollPost',
              },
            ],
          },
          relatedContent: {
            relatedContentItems: [
              {
                layoutItem: {
                  behavior: 'Readonly',
                  field: 'CampaignId',
                },
              },
              {
                layoutItem: {
                  component: 'runtime_sales_social:socialPanel',
                },
              },
            ],
          },
          relatedLists: [
            {
              fields: [
                'TASK.STATUS',
                'ACTIVITY.TASK',
              ],
              relatedList: 'RelatedActivityList',
            },
            {
              fields: [
                'TASK.SUBJECT',
                'TASK.DUE_DATE',
              ],
              relatedList: 'RelatedHistoryList',
            },
          ],
        })

        // make sure we create a new layout and don't use an old one
        await adapter.remove(layout).catch(() => undefined)
      })

      describe('create layout', () => {
        it('should create layout', async () => {
          layout = (await adapter.add(layout)) as InstanceElement
          expect(await objectExists('Layout', 'Lead-MyLayout')).toBeTruthy()
        })
      })

      describe('update layout', () => {
        it('should update layout', async () => {
          const newLayout = layout.clone()

          // edit layout sections
          newLayout.value.layoutSections[0].style = 'OneColumn'
          newLayout.value.layoutSections[0].layoutColumns = {
            layoutItems: [
              {
                behavior: 'Required',
                field: 'Name',
              },
              {
                behavior: 'Edit',
                field: 'Phone',
              },
              {
                behavior: 'Required',
                field: 'Company',
              },
              {
                behavior: 'Edit',
                field: 'Email',
              },
              {
                behavior: 'Required',
                field: 'Status',
              },
            ],
          }
          newLayout.value.layoutSections[1].label = 'Updated Label'

          // edit layout quick actions
          newLayout.value.quickActionList.quickActionListItems = [
            {
              quickActionName: 'FeedItem.PollPost',
            },
            {
              quickActionName: 'FeedItem.ContentPost',
            },

          ]

          // edit layout related lists
          newLayout.value.relatedLists = [{
            fields: [
              'TASK.LAST_UPDATE',
              'TASK.DUE_DATE',
            ],
            relatedList: 'RelatedHistoryList',
          }]

          layout = (await adapter.update(layout, newLayout,
            [{ action: 'modify', data: { before: layout, after: newLayout } }])) as InstanceElement

          const layoutInfo = (await client.readMetadata('Layout', 'Lead-MyLayout'))[0]
          expect(layoutInfo).toBeDefined()
          const layoutSections = _.get(layoutInfo, 'layoutSections')
          expect(layoutSections[0].style).toEqual('OneColumn')
          expect(layoutSections[0].layoutColumns.layoutItems)
            .toEqual([
              {
                behavior: 'Required',
                field: 'Name',
              },
              {
                behavior: 'Edit',
                field: 'Phone',
              },
              {
                behavior: 'Required',
                field: 'Company',
              },
              {
                behavior: 'Edit',
                field: 'Email',
              },
              {
                behavior: 'Required',
                field: 'Status',
              },
            ])
          expect(layoutSections[1].label).toEqual('Updated Label')
          const quickActionItems = _.get(layoutInfo, 'quickActionList').quickActionListItems
          expect(quickActionItems[0].quickActionName).toEqual('FeedItem.PollPost')
          expect(quickActionItems[1].quickActionName).toEqual('FeedItem.ContentPost')
          const relatedLists = _.get(layoutInfo, 'relatedLists')
          expect(relatedLists.fields).toEqual(['TASK.LAST_UPDATE', 'TASK.DUE_DATE'])
        })
      })

      describe('delete layout', () => {
        it('should delete layout', async () => {
          await adapter.remove(layout)
          expect(await objectExists('Layout', 'Lead-MyLayout')).toBeFalsy()
        })
      })

      describe('instance reference string is resolved as a reference', () => {
        it('should point parentRole to a Role instance', () => {
          const childRole = findElements(result, 'Role', 'TestChildRole')[0] as InstanceElement
          expect(childRole.value.parentRole).toBeInstanceOf(ReferenceExpression)
          expect(childRole.value.parentRole.elemId.typeName).toEqual('Role')
        })
      })
    })
  })
})
