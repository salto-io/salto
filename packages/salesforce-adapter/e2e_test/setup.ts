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
import { MetadataInfo } from '@salto-io/jsforce'
import { ObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import * as constants from '../src/constants'
import { CustomField, ProfileInfo } from '../src/client/types'
import { createDeployPackage } from '../src/transformers/xml_transformer'
import {
  MetadataValues,
  createInstanceElement,
} from '../src/transformers/transformer'
import SalesforceClient from '../src/client/client'
import { mockTypes, mockDefaultValues } from '../test/mock_elements'
import { removeMetadataIfAlreadyExists } from './utils'

export const gvsName = 'TestGlobalValueSet'
export const accountApiName = 'Account'
export const customObjectWithFieldsName = 'TestFields__c'
export const customObjectAddFieldsName = 'TestAddFields__c'
export const summaryFieldName = 'Case.summary__c'

const { awu } = collections.asynciterable
const randomString = String(Date.now()).substring(6)

export const CUSTOM_FIELD_NAMES = {
  ROLLUP_SUMMARY: 'rollupsummary__c',
  PICKLIST: 'Pickle__c',
  CURRENCY: 'Alpha__c',
  AUTO_NUMBER: 'Bravo__c',
  DATE: 'Charlie__c',
  TIME: 'Delta__c',
  MULTI_PICKLIST: 'Hotel__c',
  DATE_TIME: 'Echo__c',
  EMAIL: 'Foxtrot__c',
  LOCATION: 'Golf__c',
  PERCENT: 'India__c',
  PHONE: 'Juliett__c',
  LONG_TEXT_AREA: 'Kilo__c',
  RICH_TEXT_AREA: 'Lima__c',
  TEXT_AREA: 'Mike__c',
  ENCRYPTED_TEXT: 'November__c',
  URL: 'Oscar__c',
  NUMBER: 'Papa__c',
  TEXT: 'Sierra__c',
  CHECKBOX: 'Tango__c',
  GLOBAL_PICKLIST: 'Uniform__c',
  LOOKUP: `Quebec${randomString}__c`,
  MASTER_DETAIL: `Romeo${randomString}__c`,
  FORMULA: 'Whiskey__c',
}

export const removeCustomObjectsWithVariousFields = async (
  client: SalesforceClient,
): Promise<void> => {
  const deployPkg = createDeployPackage()
  deployPkg.delete(mockTypes.CustomObject, customObjectWithFieldsName)
  deployPkg.delete(mockTypes.CustomObject, customObjectAddFieldsName)
  await client.deploy(await deployPkg.getZip())
}

export const verifyElementsExist = async (
  client: SalesforceClient,
): Promise<void> => {
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
    await removeMetadataIfAlreadyExists(
      client,
      constants.CUSTOM_FIELD,
      summaryFieldName,
    )
    await removeCustomObjectsWithVariousFields(client)
    const objectToAdd = {
      deploymentStatus: 'Deployed',
      fields: [
        {
          fullName: CUSTOM_FIELD_NAMES.PICKLIST,
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
          fullName: CUSTOM_FIELD_NAMES.CURRENCY,
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
          fullName: CUSTOM_FIELD_NAMES.AUTO_NUMBER,
          label: 'Autonumber label',
          description: 'Autonumber description',
          inlineHelpText: 'Autonumber help',
          externalId: true,
          type: constants.FIELD_TYPE_NAMES.AUTONUMBER,
        },
        {
          defaultValue: 'Today() + 7',
          fullName: CUSTOM_FIELD_NAMES.DATE,
          label: 'Date label',
          description: 'Date description',
          inlineHelpText: 'Date help',
          required: false,
          type: constants.FIELD_TYPE_NAMES.DATE,
        },
        {
          defaultValue: 'TIMENOW() + 5',
          fullName: CUSTOM_FIELD_NAMES.TIME,
          label: 'Time label',
          description: 'Time description',
          inlineHelpText: 'Time help',
          required: true,
          type: constants.FIELD_TYPE_NAMES.TIME,
        },
        {
          defaultValue: 'NOW() + 7',
          fullName: CUSTOM_FIELD_NAMES.DATE_TIME,
          label: 'DateTime label',
          description: 'DateTime description',
          inlineHelpText: 'DateTime help',
          required: false,
          type: constants.FIELD_TYPE_NAMES.DATETIME,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.EMAIL,
          label: 'Email label',
          required: false,
          unique: true,
          externalId: true,
          type: constants.FIELD_TYPE_NAMES.EMAIL,
        },
        {
          displayLocationInDecimal: true,
          fullName: CUSTOM_FIELD_NAMES.LOCATION,
          label: 'Location label',
          required: false,
          scale: 2,
          type: constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.PERCENT,
          label: 'Percent label',
          description: 'Percent description',
          precision: 12,
          required: false,
          scale: 3,
          type: constants.FIELD_TYPE_NAMES.PERCENT,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.PHONE,
          label: 'Phone label',
          inlineHelpText: 'Phone help',
          required: true,
          type: constants.FIELD_TYPE_NAMES.PHONE,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.LONG_TEXT_AREA,
          label: 'LongTextArea label',
          length: 32700,
          required: false,
          type: constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
          visibleLines: 5,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.RICH_TEXT_AREA,
          label: 'RichTextArea label',
          description: 'RichTextArea description',
          inlineHelpText: 'RichTextArea help',
          length: 32600,
          required: false,
          type: constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
          visibleLines: 32,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.TEXT_AREA,
          label: 'TextArea label',
          description: 'TextArea description',
          inlineHelpText: 'TextArea help',
          required: false,
          type: constants.FIELD_TYPE_NAMES.TEXTAREA,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.ENCRYPTED_TEXT,
          label: 'EncryptedText label',
          length: 35,
          maskChar: 'asterisk',
          maskType: 'creditCard',
          required: false,
          type: constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.URL,
          label: 'Url label',
          required: false,
          type: constants.FIELD_TYPE_NAMES.URL,
        },
        {
          defaultValue: 42,
          fullName: CUSTOM_FIELD_NAMES.NUMBER,
          label: 'Number label',
          precision: 15,
          required: false,
          scale: 3,
          type: constants.FIELD_TYPE_NAMES.NUMBER,
          unique: true,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.TEXT,
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
          fullName: CUSTOM_FIELD_NAMES.CHECKBOX,
          label: 'Checkbox label',
          type: constants.FIELD_TYPE_NAMES.CHECKBOX,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.GLOBAL_PICKLIST,
          label: 'Global Picklist label',
          required: false,
          valueSet: {
            restricted: true,
            valueSetName: gvsName,
          },
          type: constants.FIELD_TYPE_NAMES.PICKLIST,
        },
        {
          fullName: CUSTOM_FIELD_NAMES.MASTER_DETAIL,
          label: 'MasterDetail label',
          referenceTo: ['Case'],
          relationshipName: CUSTOM_FIELD_NAMES.MASTER_DETAIL.split(
            constants.SALESFORCE_CUSTOM_SUFFIX,
          )[0],
          reparentableMasterDetail: true,
          required: false,
          type: constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
          writeRequiresMasterRead: true,
          relationshipOrder: 0,
        },
        {
          formula: '5 > 4',
          fullName: CUSTOM_FIELD_NAMES.FORMULA,
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
    const additionalFieldsToAdd = [
      {
        fullName: `${customObjectWithFieldsName}.${CUSTOM_FIELD_NAMES.MULTI_PICKLIST}`,
        label: 'Multipicklist label',
        required: false,
        type: constants.FIELD_TYPE_NAMES.MULTIPICKLIST,
        valueSet: {
          controllingField: CUSTOM_FIELD_NAMES.PICKLIST,
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
              controllingFieldValue: ['NEW', 'OLD'],
              valueName: 'DO',
            },
            {
              controllingFieldValue: ['OLD'],
              valueName: 'RE',
            },
          ],
        },
        visibleLines: 4,
      },
      {
        fullName: `${accountApiName}.${CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY}`,
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
      },
    ]
    const lookupField = {
      deleteConstraint: 'Restrict',
      fullName: CUSTOM_FIELD_NAMES.LOOKUP,
      label: 'Lookup label',
      referenceTo: ['Opportunity'],
      relationshipName: CUSTOM_FIELD_NAMES.LOOKUP.split(
        constants.SALESFORCE_CUSTOM_SUFFIX,
      )[0],
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
      filterItems: [
        {
          field: 'Opportunity.OwnerId',
          operation: 'equals',
          valueField: '$User.Id',
        },
        {
          field: 'Opportunity.NextStep',
          operation: 'equals',
          value: 'NextStepValue',
        },
      ],
    }
    await verifyObjectsDependentFieldsExist()
    await client.upsert(constants.CUSTOM_OBJECT, objectToAdd as MetadataInfo)
    await client.upsert(
      constants.CUSTOM_FIELD,
      additionalFieldsToAdd as MetadataInfo[],
    )

    // Add the fields permissions
    const objectFieldNames = objectToAdd.fields
      .filter((field) => !field.required)
      .filter(
        (field) => field.type !== constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
      )
      .map((field) => `${customObjectWithFieldsName}.${field.fullName}`)
    const additionalFieldNames = additionalFieldsToAdd
      .filter((field) => !field.required)
      .map((f) => f.fullName)
    const fieldNames = objectFieldNames.concat(additionalFieldNames)
    await client.upsert(constants.PROFILE_METADATA_TYPE, {
      fullName: constants.ADMIN_PROFILE,
      fieldPermissions: fieldNames.map((name) => ({
        field: name,
        editable: true,
        readable: true,
      })),
    } as ProfileInfo)

    // update lookup filter
    await client.upsert(
      constants.CUSTOM_FIELD,
      Object.assign(lookupField, {
        fullName: `${customObjectWithFieldsName}.${CUSTOM_FIELD_NAMES.LOOKUP}`,
        lookupFilter,
      }),
    )
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
      fields: ['Address', 'Company'],
      label: 'E2E Fetch CompactLayout',
    } as MetadataInfo)
  }

  const verifyCustomObjectInnerTypesExist = async (): Promise<void> => {
    await verifyLeadHasBusinessProcess() // RecordType depends on BusinessProcess
    await Promise.all([
      verifyLeadHasValidationRule(),
      verifyLeadHasRecordType(),
      verifyLeadHasWebLink(),
      verifyLeadHasListView(),
      verifyLeadHasFieldSet(),
      verifyLeadHasCompactLayout(),
    ])
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

  const verifyDeployableInstancesExist = async (): Promise<void> => {
    const instances: [MetadataValues, ObjectType][] = [
      [mockDefaultValues.ApexClass, mockTypes.ApexClass],
      [mockDefaultValues.ApexPage, mockTypes.ApexPage],
      [mockDefaultValues.AuraDefinitionBundle, mockTypes.AuraDefinitionBundle],
      [
        mockDefaultValues.LightningComponentBundle,
        mockTypes.LightningComponentBundle,
      ],
      [mockDefaultValues.StaticResource, mockTypes.StaticResource],
    ]
    const pkg = createDeployPackage()
    await awu(instances).forEach(async ([values, type]) => {
      await pkg.add(createInstanceElement(values, type))
    })
    await client.deploy(await pkg.getZip())
  }

  await Promise.all([
    addCustomObjectWithVariousFields(),
    verifyEmailTemplateAndFolderExist(),
    verifyReportAndFolderExist(),
    verifyDashboardAndFolderExist(),
    verifyCustomObjectInnerTypesExist(),
    verifyFlowExists(),
    verifyRolesExist(),
    verifyLeadHasConvertSettings(),
    verifyDeployableInstancesExist(),
  ])
}
