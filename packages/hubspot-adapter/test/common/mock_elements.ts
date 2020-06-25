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
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { HUBSPOT, OBJECTS_NAMES } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'

const firstFormMock = {
  portalId: 6774238,
  guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
  name: 'formTest1',
  action: '',
  method: 'POST',
  cssClass: 'abc',
  followUpId: 'DEPRECATED',
  editable: true,
  createdAt: 1571588456053,
  cloneable: true,
}

const secondFormMock = {
  portalId: 6774238,
  guid: '123e11f3-111-418f-92e0-cwwwe2b6999',
  name: 'formTest2',
  action: '',
  method: 'POST',
  cssClass: 'css',
  followUpId: 'DEPRECATED',
  editable: false,
  createdAt: 1561581451052,
  cloneable: true,
  captchaEnabled: false,
}

export const formsMockArray = [
  firstFormMock,
  secondFormMock,
] as unknown

export const g1PropInstance = new InstanceElement(
  'g1',
  Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY],
  {
    name: 'g1',
    label: 'g1',
    type: 'string',
    fieldType: 'text',
    description: 'g1 property',
    hidden: false,
    displayOrder: 1,
  },
  [HUBSPOT, 'records', Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY].elemID.name, 'g1'],
)

const g1PropReference = new ReferenceExpression(
  g1PropInstance.elemID,
  g1PropInstance,
  g1PropInstance
)

export const formInstance = new InstanceElement(
  'mockForm',
  Types.hubspotObjects[OBJECTS_NAMES.FORM],
  {
    portalId: 6774238,
    guid: 'guid',
    name: 'formName',
    action: '',
    method: 'POST',
    cssClass: '',
    editable: true,
    deletable: false,
    createdAt: 1500588456053,
    redirect: 'google.com',
    submitText: '',
    cloneable: false,
    captchaEnabled: true,
    formFieldGroups: [
      {
        fields: [
          {
            name: 'g1',
            label: 'g1!',
            type: 'string',
            fieldType: 'text',
            description: 'g1 property',
            required: false,
            hidden: false,
            displayOrder: 1,
            defaultValue: '',
            isSmartField: false,
            selectedOptions: [],
            options: [],
            dependentFieldFilters: [
              {
                filters: [
                  {
                    operator: 'EQ',
                    strValue: 'em@salto.io',
                    boolValue: false,
                    numberValue: 0,
                    strValues: [],
                    numberValues: [],
                  },
                ],
                dependentFormField: {
                  name: 'date_of_birth',
                  label: 'Date of birth override',
                  type: 'string',
                  fieldType: 'text',
                  description: 'l',
                  groupName: 'contactinformation',
                  displayOrder: 1,
                  required: false,
                  selectedOptions: [],
                  options: [],
                  enabled: true,
                  hidden: false,
                  isSmartField: false,
                  unselectedLabel: 'unselected',
                  placeholder: 'place',
                  dependentFieldFilters: [],
                  labelHidden: false,
                  propertyObjectType: 'CONTACT',
                  metaData: [],
                },
                formFieldAction: 'DISPLAY',
              },
            ],
          },
        ],
        default: true,
        isSmartGroup: false,
      },
      {
        fields: [
          {
            name: 'value',
            label: 'Value',
            type: 'string',
            fieldType: 'text',
            description: '',
            required: false,
            hidden: false,
            defaultValue: '',
            isSmartField: false,
            displayOrder: 1,
            selectedOptions: ['val1'],
            options: [
              {
                label: 'opt1',
                value: 'val1',
                hidden: true,
                readOnly: true,
              },
            ],
          },
        ],
        default: true,
        isSmartGroup: false,
      },
    ],
    ignoreCurrentValues: false,
    inlineMessage: 'inline',
    themeName: 'theme',
    notifyRecipients: '',
  },
)

export const datePropInstance = new InstanceElement(
  'date_of_birth',
  Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY],
  {
    name: 'date_of_birth',
    label: 'Date of birth',
    type: 'string',
    fieldType: 'text',
    description: 'date of birth',
    hidden: false,
    displayOrder: 1,
  },
  [HUBSPOT, 'records', Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY].elemID.name, 'date_of_birth'],
)

const datePropReference = new ReferenceExpression(
  datePropInstance.elemID,
  datePropInstance,
  datePropInstance
)

export const valuePropInstance = new InstanceElement(
  'value',
  Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY],
  {
    name: 'value',
    label: 'Value',
    type: 'string',
    fieldType: 'text',
    description: 'value property',
    hidden: false,
    options: [
      {
        label: 'opt',
        value: 'val1',
        hidden: true,
        readOnly: true,
      },
    ],
    displayOrder: 1,
  },
  [HUBSPOT, 'records', Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY].elemID.name, 'value'],
)

const valuePropReference = new ReferenceExpression(
  valuePropInstance.elemID,
  valuePropInstance,
  valuePropInstance
)

export const beforeFormInstanceValuesMock = {
  name: 'beforeUpdateInstance',
  guid: 'guid',
  followUpId: 'DEPRECATED',
  editable: true,
  cloneable: true,
  captchaEnabled: false,
  inlineMessage: 'inline',
  redirect: 'google.com',
  themeName: 'theme',
  createdAt: 1500588456053,
  formFieldGroups: [
    {
      fields: [
        {
          contactProperty: g1PropReference,
          contactPropertyOverrides: {
            label: 'g1!',
          },
          dependentFieldFilters: [
            {
              filters: [
                {
                  operator: 'EQ',
                  strValue: 'em@salto.io',
                  boolValue: false,
                  numberValue: 0,
                  strValues: [],
                  numberValues: [],
                },
              ],
              dependentFormField: {
                contactProperty: datePropReference,
                contactPropertyOverrides: {
                  label: 'Date of birth override',
                },
                isSmartField: false,
                required: false,
                placeholder: 'place',
              },
              formFieldAction: 'DISPLAY',
            },
          ],
        },
      ],
      default: true,
      isSmartGroup: false,
    },
    {
      fields: [
        {
          contactProperty: valuePropReference,
          contactPropertyOverrides: {
            options: [
              {
                label: 'opt1',
                value: 'val1',
                hidden: true,
                readOnly: true,
              },
            ],
          },
          isSmartField: false,
          required: false,
          selectedOptions: ['val1'],
        },
      ],
      default: true,
      isSmartGroup: false,
    },
  ],
}

export const afterFormInstanceValuesMock = {
  name: 'afterUpdateInstance',
  guid: 'guid',
  followUpId: 'DEPRECATED',
  editable: true,
  cloneable: true,
  captchaEnabled: false,
  inlineMessage: 'inline',
  redirect: 'google.com',
  themeName: 'theme',
  createdAt: 1500588456053,
  formFieldGroups: [
    {
      fields: [
        {
          contactProperty: g1PropReference,
          contactPropertyOverrides: {
            label: 'g1!',
          },
          helpText: 'helpText',
          dependentFieldFilters: [
            {
              filters: [
                {
                  operator: 'EQ',
                  strValue: 'em@salto.io',
                  boolValue: false,
                  numberValue: 0,
                  strValues: [],
                  numberValues: [],
                },
              ],
              dependentFormField: {
                contactProperty: datePropReference,
                helpText: 'HELP!',
                contactPropertyOverrides: {
                  label: 'Date of birth override',
                },
                isSmartField: false,
                required: false,
                placeholder: 'place',
              },
              formFieldAction: 'DISPLAY',
            },
          ],
        },
      ],
      default: true,
      isSmartGroup: false,
    },
    {
      fields: [
        {
          contactProperty: valuePropReference,
          contactPropertyOverrides: {
            options: [
              {
                label: 'opt1',
                value: 'val1',
                hidden: true,
                readOnly: true,
              },
            ],
          },
          isSmartField: false,
          required: false,
          selectedOptions: ['val1'],
        },
      ],
      default: true,
      isSmartGroup: false,
    },
  ],
}

/**
 * Workflow Mock Instances
 */
const firstWorkflowMock = {
  id: 12345,
  name: 'workflowTest1',
  type: 'PROPERTY_ANCHOR',
  unsupportedField: 'bla',
  enabled: true,
  insertedAt: 13423432,
  updatedAt: 2423432,
  internal: false,
  onlyExecOnBizDays: false,
  listening: true,
  allowContactToTriggerMultipleTimes: true,
  onlyEnrollManually: false,
  enrollOnCriteriaUpdate: true,
  lastUpdatedBy: 'asb@gm.il',
  supressionListIds: [
    1234,
    1,
  ],
  eventAnchor: {
    contactPropertyAnchor: 'hs_content_membership_registered_at',
  },
  nurtureTimeRange: {
    enabled: false,
    startHour: 9,
    stopHour: 10,
  },
  segmentCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'gmail.com;salto.io',
      },
    ],
    [
      {
        filterFamily: 'CompanyPropertyValue',
        withinTimeMode: 'PAST',
        propertyObjectType: 'COMPANY',
        operator: 'EQ',
        type: 'string',
        property: 'name',
        value: 'Salto',
      },
    ],
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'salto.com',
      },
    ],
  ],
  goalCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'firstname',
        value: 'Adam;Ben;Maayan',
      },
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'industry',
        value: 'abc',
      },
    ],
  ],
  actions: [
    {
      type: 'DELAY',
      delayMillis: 0,
      actionId: 170629910,
      anchorSetting: {
        execTimeOfDay: '11:30 AM',
        execTimeInMinutes: 690,
        boundary: 'ON',
      },
      stepId: 2,
    },
    {
      type: 'SET_CONTACT_PROPERTY',
      propertyName: 'fax',
      newValue: 'abcdefg',
      actionId: 170629911,
      stepId: 2,
    },
    {
      type: 'BRANCH',
      actionId: 170629912,
      filtersListId: 29,
      stepId: 2,
      acceptActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
      rejectActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
    },
  ],
}

const secondWorkflowMock = {
  id: 123456,
  name: 'workflowTest2',
  type: 'PROPERTY_ANCHOR',
  unsupportedField: 'bla',
  enabled: true,
  insertedAt: 13423432,
  updatedAt: 2423432,
  internal: false,
  onlyExecOnBizDays: false,
  listening: true,
  allowContactToTriggerMultipleTimes: true,
  onlyEnrollManually: false,
  enrollOnCriteriaUpdate: true,
  lastUpdatedBy: 'asb@gm.il',
  supressionListIds: [
    1234,
    1,
  ],
  eventAnchor: {
    contactPropertyAnchor: 'hs_content_membership_registered_at',
  },
  nurtureTimeRange: {
    enabled: false,
    startHour: 9,
    stopHour: 10,
  },
  segmentCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'gmail.com;salto.io',
      },
    ],
    [
      {
        filterFamily: 'CompanyPropertyValue',
        withinTimeMode: 'PAST',
        propertyObjectType: 'COMPANY',
        operator: 'EQ',
        type: 'string',
        property: 'name',
        value: 'Salto',
      },
    ],
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'salto.com',
      },
    ],
  ],
  goalCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'firstname',
        value: 'Adam;Ben;Maayan',
      },
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'industry',
        value: 'abc',
      },
    ],
  ],
  actions: [
    {
      type: 'DELAY',
      delayMillis: 0,
      actionId: 170629910,
      anchorSetting: {
        execTimeOfDay: '11:30 AM',
        execTimeInMinutes: 690,
        boundary: 'ON',
      },
      stepId: 2,
    },
    {
      type: 'SET_CONTACT_PROPERTY',
      propertyName: 'fax',
      newValue: 'abcdefg',
      actionId: 170629911,
      stepId: 2,
    },
    {
      type: 'BRANCH',
      actionId: 170629912,
      filtersListId: 29,
      stepId: 2,
      acceptActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
      rejectActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
    },
  ],
}

export const workflowsMock = {
  id: 1234,
  name: 'workflowTest',
  type: 'PROPERTY_ANCHOR',
  unsupportedField: 'bla',
  enabled: true,
  insertedAt: 13423432,
  updatedAt: 2423432,
  internal: false,
  onlyExecOnBizDays: false,
  listening: true,
  allowContactToTriggerMultipleTimes: true,
  onlyEnrollManually: false,
  enrollOnCriteriaUpdate: true,
  lastUpdatedBy: 'asb@gm.il',
  supressionListIds: [
    1234,
    1,
  ],
  eventAnchor: {
    contactPropertyAnchor: 'hs_content_membership_registered_at',
  },
  nurtureTimeRange: {
    enabled: false,
    startHour: 9,
    stopHour: 10,
  },
  segmentCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'gmail.com;salto.io',
      },
    ],
    [
      {
        filterFamily: 'CompanyPropertyValue',
        withinTimeMode: 'PAST',
        propertyObjectType: 'COMPANY',
        operator: 'EQ',
        type: 'string',
        property: 'name',
        value: 'Salto',
      },
    ],
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'salto.com',
      },
    ],
  ],
  goalCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'firstname',
        value: 'Adam;Ben;Maayan',
      },
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'industry',
        value: 'abc',
      },
    ],
  ],
  actions: [
    {
      type: 'DELAY',
      delayMillis: 0,
      actionId: 170629910,
      anchorSetting: {
        execTimeOfDay: '11:30 AM',
        execTimeInMinutes: 690,
        boundary: 'ON',
      },
      stepId: 2,
    },
    {
      type: 'SET_CONTACT_PROPERTY',
      propertyName: 'fax',
      newValue: 'abcdefg',
      actionId: 170629911,
      stepId: 2,
    },
    {
      type: 'BRANCH',
      actionId: 170629912,
      filtersListId: 29,
      stepId: 2,
      acceptActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
      rejectActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
    },
  ],
}

export const workflowsCreateResponse = {
  portalId: 62515,
  id: 9274658,
  name: workflowsMock.name,
  updatedAt: 1579426531143,
  insertedAt: 1579426531213,
  type: workflowsMock.type,
  enabled: workflowsMock.enabled,
  description: '',
  contactCounts: {
    active: 0,
    enrolled: 0,
  },
  eventAnchor: {
    contactPropertyAnchor: 'hs_content_membership_registered_at',
  },
  migrationStatus: {
    portalId: 62515,
    flowId: 7102706,
    workflowId: 5488642,
    migrationStatus: 'EXECUTION_MIGRATED',
    platformOwnsActions: true,
    lastSuccessfulMigrationTimestamp: null,
  },
  originalAuthorUserId: 215482,
  creationSource: {
    sourceApplication: {
      source: 'WORKFLOWS_APP',
      serviceName: 'https://app.hubspot.com/workflows/6962502/platform/create/new',
    },
    createdByUser: {
      userId: 9379192,
      userEmail: 'adam.rosenthal@salto.io',
    },
    createdAt: 1579069732474,
  },
  updateSource: {
    sourceApplication: {
      source: 'WORKFLOWS_APP',
      serviceName: 'https://app.hubspot.com/workflows/6962502/platform/flow/18538464/edit/actions/enrollment/filters',
    },
    updatedByUser: {
      userId: 9379192,
      userEmail: 'adam.rosenthal@salto.io',
    },
    updatedAt: 1579070462059,
    contactListIds: {
      enrolled: 20,
      active: 21,
      completed: 22,
      succeeded: 23,
    },
  },
  internal: false,
  onlyExecOnBizDays: false,
  listening: true,
  allowContactToTriggerMultipleTimes: true,
  onlyEnrollManually: false,
  enrollOnCriteriaUpdate: true,
  lastUpdatedBy: 'asb@gm.il',
  supressionListIds: [
    12345,
    12,
  ],
  nurtureTimeRange: {
    enabled: false,
    startHour: 9,
    stopHour: 10,
  },
  segmentCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'gmail.com;salto.io',
      },
    ],
    [
      {
        filterFamily: 'CompanyPropertyValue',
        withinTimeMode: 'PAST',
        propertyObjectType: 'COMPANY',
        operator: 'EQ',
        type: 'string',
        property: 'name',
        value: 'Salto',
      },
    ],
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'hs_email_domain',
        value: 'salto.com',
      },
    ],
  ],
  goalCriteria: [
    [
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'firstname',
        value: 'Adam;Ben;Maayan',
      },
      {
        filterFamily: 'PropertyValue',
        withinTimeMode: 'PAST',
        operator: 'EQ',
        type: 'string',
        property: 'industry',
        value: 'abc',
      },
    ],
  ],
  actions: [
    {
      type: 'DELAY',
      delayMillis: 0,
      actionId: 170629910,
      anchorSetting: {
        execTimeOfDay: '11:30 AM',
        execTimeInMinutes: 690,
        boundary: 'ON',
      },
      stepId: 2,
    },
    {
      type: 'SET_CONTACT_PROPERTY',
      propertyName: 'fax',
      newValue: 'abcdefg',
      actionId: 170629911,
      stepId: 2,
    },
    {
      type: 'BRANCH',
      actionId: 170629912,
      filtersListId: 29,
      stepId: 2,
      acceptActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
      rejectActions: [
        {
          type: 'SMS_NOTIFICATION',
          staticTo: '+113455333434',
          body: 'Hello world',
          actionId: 170629913,
          stepId: 1,
        },
      ],
    },
  ],
}

export const workflowsMockArray = [
  firstWorkflowMock,
  secondWorkflowMock,
  workflowsMock,
]

/*
* Contact Property
*/
export const contactPropertyMock = {
  name: 'dropdownexample',
  label: 'DropDownExample',
  description: 'description',
  groupName: 'contactinformation',
  type: 'enumeration',
  fieldType: 'select',
  hidden: false,
  options: [
    {
      description: 'desc A',
      label: 'A',
      hidden: false,
      displayOrder: 0,
      value: 'A',
    },
    {
      description: 'desc B',
      label: 'B2',
      hidden: false,
      displayOrder: 1,
      value: 'B2',
    },
    {
      description: 'desc C',
      label: 'C22',
      hidden: false,
      displayOrder: 2,
      value: 'C22',
    },
  ],
  deleted: false,
  createdAt: 1578482459242,
  formField: true,
  displayOrder: -1,
  readOnlyValue: false,
  readOnlyDefinition: false,
  mutableDefinitionNotDeletable: false,
  favorited: false,
  favoritedOrder: -1,
  calculated: false,
  externalOptions: false,
  displayMode: 'current_value',
  updatedAt: 1580989573781,
  hasUniqueValue: false,
  createdUserId: 9379192,
  searchableInGlobalSearch: false,
  unsupported: 'lala',
}

const firstContactPropertyMock = {
  name: 'dropdownexamplefirst',
  label: 'DropDownExampleFirst',
  description: 'description',
  groupName: 'contactinformation',
  type: 'enumeration',
  fieldType: 'select',
  hidden: false,
  options: [
    {
      description: 'desc A',
      label: 'A',
      hidden: false,
      displayOrder: 0,
      value: 'A First',
    },
    {
      description: 'desc B',
      label: 'B',
      hidden: false,
      displayOrder: 1,
      value: 'B First',
    },
    {
      description: 'desc C',
      label: 'C',
      hidden: false,
      displayOrder: 2,
      value: 'C First',
    },
  ],
  deleted: false,
  createdAt: 1578482459242,
  formField: true,
  displayOrder: -1,
  readOnlyValue: false,
  readOnlyDefinition: false,
  mutableDefinitionNotDeletable: false,
  favorited: false,
  favoritedOrder: -1,
  calculated: false,
  externalOptions: false,
  displayMode: 'current_value',
  updatedAt: 1580989573781,
  hasUniqueValue: false,
  createdUserId: 9379192,
  searchableInGlobalSearch: false,
}

const secondContactPropertyMock = {
  name: 'dropdownexampleSecond',
  label: 'DropDownExampleSecond',
  description: 'description',
  groupName: 'contactinformation',
  type: 'enumeration',
  fieldType: 'select',
  hidden: false,
  options: [
    {
      description: 'desc A',
      label: 'A',
      hidden: false,
      displayOrder: 0,
      value: 'A Second',
    },
    {
      description: 'desc B',
      label: 'B',
      hidden: false,
      displayOrder: 1,
      value: 'B Second',
    },
    {
      description: 'desc C',
      label: 'C',
      hidden: false,
      displayOrder: 2,
      value: 'C Second',
    },
  ],
  deleted: false,
  createdAt: 1578482459242,
  formField: true,
  displayOrder: -1,
  readOnlyValue: false,
  readOnlyDefinition: false,
  mutableDefinitionNotDeletable: false,
  favorited: false,
  favoritedOrder: -1,
  calculated: false,
  externalOptions: false,
  displayMode: 'current_value',
  updatedAt: 1580989573781,
  hasUniqueValue: false,
  createdUserId: 9379192,
  searchableInGlobalSearch: false,
}

export const contactPropertyCreateResponse = {
  calculated: false,
  createdAt: 1581235926150,
  createdUserId: null,
  currencyPropertyName: null,
  deleted: false,
  description: 'description',
  displayMode: 'current_value',
  displayOrder: -1,
  externalOptions: false,
  favorited: false,
  favoritedOrder: -1,
  fieldType: 'select',
  formField: true,
  groupName: 'contactinformation',
  hasUniqueValue: false,
  hidden: false,
  hubspotDefined: null,
  isCustomizedDefault: false,
  label: 'DropDownExample',
  mutableDefinitionNotDeletable: false,
  name: 'dropdownexample',
  numberDisplayHint: null,
  optionSortStrategy: null,
  options: [
    {
      description: 'desc A',
      displayOrder: 0,
      doubleData: null,
      hidden: false,
      label: 'A',
      readOnly: null,
      value: 'A',
    },
    {
      description: 'desc B',
      displayOrder: 1,
      doubleData: null,
      hidden: false,
      label: 'B2',
      readOnly: null,
      value: 'B2',
    },
    {
      description: 'desc C',
      displayOrder: 2,
      doubleData: null,
      hidden: false,
      label: 'C22',
      readOnly: null,
      value: 'C22',
    },
  ],
  optionsAreMutable: null,
  readOnlyDefinition: false,
  readOnlyValue: false,
  referencedObjectType: null,
  searchTextAnalysisMode: null,
  searchableInGlobalSearch: false,
  showCurrencySymbol: null,
  textDisplayHint: null,
  type: 'enumeration',
  updatedAt: 1581235926150,
  updatedUserId: null,
}

export const contactPropertyMocks = [
  contactPropertyMock,
  firstContactPropertyMock,
  secondContactPropertyMock,
] as unknown

/**
 * MarketingEmail Mock Instances
 */
const firstMarketingEmailMock = {
  ab: true,
  abHoursToWait: 12,
  abVariation: false,
  abSampleSizeDefault: 'MASTER',
  abSamplingDefault: 'MASTER',
  abStatus: 'MASTER',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '1234',
  abTestPercentage: 40,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [
    123,
  ],
  analyticsPageId: '1234',
  archived: false,
  author: 'mail@gmail.com',
  authorEmail: 'mail123@gmail.com',
  authorName: 'userName',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  clonedFrom: 1234,
  createPage: false,
  created: 12334567,
  currentlyPublished: true,
  domain: 'ynet.com',
  emailBody: 'main email body',
  emailNote: 'email notes',
  emailType: 'AB_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 1234,
  folderId: 999,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 111111,
  isGraymailSuppressionEnabled: false,
  isLocalTimezoneSend: false,
  isPublished: true,
  name: 'marketingEmail instance name',
  authorAt: 124543,
  authorUserId: 12345,
  canSpamSettingsId: 67899,
  flexArea: {
    main: {
      boxFirstElementIndex: 0,
      boxLastElementIndex: 0,
      boxed: false,
      isSingleColumnFullWidth: false,
      sections: [
        {
          columns: [
            {
              id: 'builtin_column_0-0',
              widgets: ['builtin_module_0_0_0'],
              width: 12,
            },
          ],
          id: 'builtin_section-0',
          style: {
            backgroundColor: '#EAF0F6',
            backgroundType: 'CONTENT',
            paddingBottom: '10px',
            paddingTop: '10px',
          },
        },
      ],
    },
  },
  isRecipientFatigueSuppressionEnabled: false,
  leadFlowId: 1234,
  liveDomain: 'my-website.hs-sites.com',
  mailingListsExcluded: [1],
  mailingListsIncluded: [2],
  maxRssEntries: 5,
  metaDescription: '',
  pageExpirtyDate: 1234563463,
  pageExpiryRedirectId: 356,
  previewKey: 'abcDeGHY',
  processingStatus: 'UNDEFINED',
  publishDate: 12423432523,
  publishedAt: 143243253253,
  publishedById: 23,
  publishedByName: 'John Doe',
  publishImmediately: true,
  publishedUrl: '',
  replyTo: 'mail@gmail.com',
  resolvedDomain: 'ynet.com',
  rssEmailAuthorLineTemplate: 'By, ',
  rssEmailNlogImageMaxWidth: 300,
  rssEmailByTest: 'By',
  rssEmailClickThroughText: 'Read more',
  rssEmailCommentText: 'Comment',
  rssEmailEntryTemplate: '',
  rssEmailEntryTemplateEnabled: false,
  rssEmailUrl: '',
  rssToEmailTiming: {
    repeats: 'daily',
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_monthly: 1,
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_weekly: 1,
    time: '9:00 am',
  },
  slug: 'slug-23412423423',
  smartEmailFields: {},
  styleSettings: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    background_color: '#EAF0F6',
  },
  subcategory: 'blog_email',
  subject: 'Subject line',
  subscription: 123456,
  subscriptionBlogId: 1234567890,
  // eslint-disable-next-line @typescript-eslint/camelcase
  subscription_name: 'Default HubSpot Blog Subscription',
  templatePath: 'generated_layouts/1345.html',
  trasactional: false,
  unpublishedAt: 0,
  updated: 1230005253,
  updatedById: 2,
  url: 'website-url.com',
  useRssHeadlineAsSubject: false,
  vidsExcluded: [1234],
  vidsIncluded: [12],
  widgets: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    builtin_module_0_0_0: {
      body: {
        alignment: 'center',
        // eslint-disable-next-line @typescript-eslint/camelcase
        hs_enable_module_padding: true,
        img: {
          alt: 'HubSpot logo orange',
          height: 72,
          src: 'https://static.hsappstatic.net/TemplateAssets/static-1.46/img/hs_default_template_images/email_dnd_template_images/company-logo-orange.png',
          width: 240,
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        module_id: 1367093,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      child_css: {},
      css: {},
      id: 'builtin_module_0_0_0',
      // eslint-disable-next-line @typescript-eslint/camelcase
      module_id: 1367093,
      name: 'builtin_module_0_0_0',
      order: 1,
      type: 'module',
    },
  },
  workflowNames: [],
}

const secondMarketingEmailMock = {
  ab: false,
  abHoursToWait: 4,
  abVariation: false,
  abSampleSizeDefault: 'MASTER',
  abSamplingDefault: 'MASTER',
  abStatus: 'VARIANT',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '1234',
  abTestPercentage: 30,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [],
  analyticsPageId: '432423',
  archived: false,
  author: 'mail1@gmail.com',
  authorEmail: 'mail13@gmail.com',
  authorName: 'userNameOther',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  clonedFrom: 1234,
  createPage: true,
  created: 12334567,
  currentlyPublished: true,
  domain: 'one.com',
  emailBody: 'main body',
  emailNote: 'emails notes',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 1234,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 222222,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  isPublished: true,
  name: 'marketingEmail instance2 name',
  authorAt: 124543,
  authorUserId: 12345,
  canSpamSettingsId: 67899,
  flexArea: {
    main: {
      boxFirstElementIndex: 0,
      boxLastElementIndex: 0,
      boxed: false,
      isSingleColumnFullWidth: false,
      sections: [
        {
          columns: [
            {
              id: 'builtin_column_0-0',
              widgets: ['builtin_module_0_0_0'],
              width: 12,
            },
          ],
          id: 'builtin_section-0',
          style: {
            backgroundColor: '#EAF0F6',
            backgroundType: 'CONTENT',
            paddingBottom: '10px',
            paddingTop: '10px',
          },
        },
      ],
    },
  },
  isRecipientFatigueSuppressionEnabled: false,
  leadFlowId: 1234,
  liveDomain: 'my-website.hs-sites.com',
  mailingListsExcluded: [1],
  mailingListsIncluded: [2],
  maxRssEntries: 5,
  metaDescription: '',
  pageExpirtyDate: 1234563463,
  pageExpiryRedirectId: 356,
  previewKey: 'abcDeGHY',
  processingStatus: 'UNDEFINED',
  publishDate: 12423432523,
  publishedAt: 143243253253,
  publishedById: 23,
  publishedByName: 'John Doe',
  publishImmediately: true,
  publishedUrl: '',
  replyTo: 'mail@gmail.com',
  resolvedDomain: 'ynet.com',
  rssEmailAuthorLineTemplate: 'By, ',
  rssEmailNlogImageMaxWidth: 300,
  rssEmailByTest: 'By',
  rssEmailClickThroughText: 'Read more',
  rssEmailCommentText: 'Comment',
  rssEmailEntryTemplate: '',
  rssEmailEntryTemplateEnabled: false,
  rssEmailUrl: '',
  rssToEmailTiming: {
    repeats: 'daily',
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_monthly: 1,
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_weekly: 1,
    time: '9:00 am',
  },
  slug: 'slug-23412423423',
  smartEmailFields: {},
  styleSettings: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    background_color: '#EAF0F6',
  },
  subcategory: 'blog_email',
  subject: 'Subject line 2',
  subscription: 123456,
  subscriptionBlogId: 1234567890,
  // eslint-disable-next-line @typescript-eslint/camelcase
  subscription_name: 'Default HubSpot Blog Subscription',
  templatePath: 'generated_layouts/1345.html',
  trasactional: false,
  unpublishedAt: 0,
  updated: 1230005253,
  updatedById: 2,
  url: 'website-url.com',
  useRssHeadlineAsSubject: false,
  vidsExcluded: [1234],
  vidsIncluded: [12],
  widgets: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    builtin_module_0_0_0: {
      body: {
        alignment: 'center',
        // eslint-disable-next-line @typescript-eslint/camelcase
        hs_enable_module_padding: true,
        img: {
          alt: 'HubSpot logo orange',
          height: 72,
          src: 'https://static.hsappstatic.net/TemplateAssets/static-1.46/img/hs_default_template_images/email_dnd_template_images/company-logo-orange.png',
          width: 240,
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        module_id: 1367093,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      child_css: {},
      css: {},
      id: 'builtin_module_0_0_0',
      // eslint-disable-next-line @typescript-eslint/camelcase
      module_id: 1367093,
      name: 'builtin_module_0_0_0',
      order: 1,
      type: 'module',
    },
  },
  workflowNames: [],
}

const thirdMarketingEmailMock = {
  ab: false,
  abHoursToWait: 11,
  abVariation: false,
  abSampleSizeDefault: 'VARIANT',
  abSamplingDefault: 'MASTER',
  abStatus: 'VARIANT',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '6543',
  abTestPercentage: 12345,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [],
  analyticsPageId: 'email ID',
  archived: false,
  author: 'mail,e@gmail.com',
  authorEmail: 'mail134@gmail.com',
  authorName: 'userNameOther1',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  clonedFrom: 1234,
  createPage: true,
  created: 12334567,
  currentlyPublished: true,
  domain: 'one.com',
  emailBody: 'main body',
  emailNote: 'emails notes',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 111,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 973287,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  isPublished: true,
  name: 'marketingEmail instance3 name',
  authorAt: 124543,
  authorUserId: 12345,
  canSpamSettingsId: 67899,
  flexArea: {
    main: {
      boxFirstElementIndex: 0,
      boxLastElementIndex: 0,
      boxed: false,
      isSingleColumnFullWidth: false,
      sections: [
        {
          columns: [
            {
              id: 'builtin_column_0-0',
              widgets: ['builtin_module_0_0_0'],
              width: 12,
            },
          ],
          id: 'builtin_section-0',
          style: {
            backgroundColor: '#EAF0F6',
            backgroundType: 'CONTENT',
            paddingBottom: '10px',
            paddingTop: '10px',
          },
        },
      ],
    },
  },
  isRecipientFatigueSuppressionEnabled: false,
  leadFlowId: 1234,
  liveDomain: 'my-website.hs-sites.com',
  mailingListsExcluded: [1],
  mailingListsIncluded: [2],
  maxRssEntries: 5,
  metaDescription: '',
  pageExpirtyDate: 1234563463,
  pageExpiryRedirectId: 356,
  previewKey: 'abcDeGHY',
  processingStatus: 'UNDEFINED',
  publishDate: 12423432523,
  publishedAt: 143243253253,
  publishedById: 23,
  publishedByName: 'John Doe',
  publishImmediately: true,
  publishedUrl: '',
  replyTo: 'mail@gmail.com',
  resolvedDomain: 'ynet.com',
  rssEmailAuthorLineTemplate: 'By, ',
  rssEmailNlogImageMaxWidth: 300,
  rssEmailByTest: 'By',
  rssEmailClickThroughText: 'Read more',
  rssEmailCommentText: 'Comment',
  rssEmailEntryTemplate: '',
  rssEmailEntryTemplateEnabled: false,
  rssEmailUrl: '',
  rssToEmailTiming: {
    repeats: 'daily',
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_monthly: 1,
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_weekly: 1,
    time: '9:00 am',
  },
  slug: 'slug-23412423423',
  smartEmailFields: {},
  styleSettings: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    background_color: '#EAF0F6',
  },
  subcategory: 'blog_email',
  subject: 'Subject line 2',
  subscription: 123456,
  subscriptionBlogId: 1234567890,
  // eslint-disable-next-line @typescript-eslint/camelcase
  subscription_name: 'Default HubSpot Blog Subscription',
  templatePath: 'generated_layouts/1345.html',
  trasactional: false,
  unpublishedAt: 0,
  updated: 1230005253,
  updatedById: 2,
  url: 'website-url.com',
  useRssHeadlineAsSubject: false,
  vidsExcluded: [1234],
  vidsIncluded: [12],
  widgets: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    builtin_module_0_0_0: {
      body: {
        alignment: 'center',
        // eslint-disable-next-line @typescript-eslint/camelcase
        hs_enable_module_padding: true,
        img: {
          alt: 'HubSpot logo orange',
          height: 72,
          src: 'https://static.hsappstatic.net/TemplateAssets/static-1.46/img/hs_default_template_images/email_dnd_template_images/company-logo-orange.png',
          width: 240,
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        module_id: 1367093,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      child_css: {},
      css: {},
      id: 'builtin_module_0_0_0',
      // eslint-disable-next-line @typescript-eslint/camelcase
      module_id: 1367093,
      name: 'builtin_module_0_0_0',
      order: 1,
      type: 'module',
    },
  },
  workflowNames: [],
}

export const marketingEmailMock = {
  name: 'newTestMarketingEmail',
  ab: false,
  abHoursToWait: 123,
  abVariation: false,
  abStatus: 'VARIANT',
  archived: false,
  author: 'mail,e@gmail.com',
  authorEmail: 'mail134@gmail.com',
  authorName: 'userNameOther1',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  clonedFrom: 1234,
  created: 12334567,
  emailBody: 'main body',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 111,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  id: 973111,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  authorAt: 124543,
  authorUserId: 12345,
  canSpamSettingsId: 67899,
  categoryId: 2,
  contentCategoryType: 2,
  flexArea: '{"main":{"boxFirstElementIndex":0,"boxLastElementIndex":0,"boxed":false,"isSingleColumnFullWidth":false,"sections":[{"columns":[{"id":"builtin_column_0-0","widgets":["builtin_module_0_0_0"],"width":12}],"id":"builtin_section-0","style":{"backgroundColor":"#EAF0F6","backgroundType":"CONTENT","paddingBottom":"10px","paddingTop":"10px"}}]}}',
  isRecipientFatigueSuppressionEnabled: false,
  leadFlowId: 1234,
  liveDomain: 'my-website.hs-sites.com',
  mailingListsExcluded: [1],
  mailingListsIncluded: [2],
  maxRssEntries: 5,
  metaDescription: '',
  pageExpirtyDate: 1234563463,
  pageExpiryRedirectId: 356,
  previewKey: 'abcDeGHY',
  processingStatus: 'UNDEFINED',
  publishDate: 12423432523,
  publishedAt: 143243253253,
  publishedById: 23,
  publishedByName: 'John Doe',
  publishImmediately: true,
  publishedUrl: '',
  replyTo: 'mail@gmail.com',
  resolvedDomain: 'ynet.com',
  rssEmailAuthorLineTemplate: 'By, ',
  rssEmailNlogImageMaxWidth: 300,
  rssEmailByTest: 'By',
  rssEmailClickThroughText: 'Read more',
  rssEmailCommentText: 'Comment',
  rssEmailEntryTemplate: '',
  rssEmailEntryTemplateEnabled: false,
  rssEmailUrl: '',
  rssToEmailTiming: {
    repeats: 'daily',
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_monthly: 1,
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_weekly: 1,
    time: '9:00 am',
  },
  slug: 'slug-23412423423',
  smartEmailFields: '{}',
  styleSettings: '{ "background_color": "#EAF0F6" }',
  subcategory: 'blog_email',
  subject: 'Subject line 2',
  subscription: 123456,
  subscriptionBlogId: 1234567890,
  // eslint-disable-next-line @typescript-eslint/camelcase
  subscription_name: 'Default HubSpot Blog Subscription',
  templatePath: 'generated_layouts/1345.html',
  trasactional: false,
  unpublishedAt: 0,
  updated: 1230005253,
  updatedById: 2,
  url: 'website-url.com',
  useRssHeadlineAsSubject: false,
  vidsExcluded: [1234],
  vidsIncluded: [12],
  widgets: '{"builtin_module_0_0_0":{"body":{"alignment":"center","hs_enable_module_padding":true,"img":{"alt":"HubSpot logo orange","height":72,"src":"https://static.hsappstatic.net/TemplateAssets/static-1.46/img/hs_default_template_images/email_dnd_template_images/company-logo-orange.png","width":240},"module_id":1367093},"child_css":{},"css":{},"id":"builtin_module_0_0_0","module_id":1367093,"name":"builtin_module_0_0_0","order":1,"type":"module"}}',
  workflowNames: [],
}

export const marketingEmailCreateResponse = {
  name: 'newTestMarketingEmail',
  ab: false,
  abHoursToWait: 123,
  abVariation: false,
  abSampleSizeDefault: null,
  abSamplingDefault: null,
  abStatus: 'VARIANT',
  archived: false,
  author: 'mail,e@gmail.com',
  authorEmail: 'mail134@gmail.com',
  authorName: 'userNameOther1',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  clonedFrom: 1234,
  createPage: false,
  created: 12334567,
  currentlyPublished: false,
  domain: '',
  emailBody: 'main body',
  emailNote: '',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 111,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: '',
  id: 1234566,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  isPublished: false,
  authorAt: 124543,
  authorUserId: 12345,
  canSpamSettingsId: 67899,
  categoryId: 2,
  contentCategoryType: 2,
  flexArea: {
    main: {
      boxFirstElementIndex: 0,
      boxLastElementIndex: 0,
      boxed: false,
      isSingleColumnFullWidth: false,
      sections: [
        {
          columns: [
            {
              id: 'builtin_column_0-0',
              widgets: ['builtin_module_0_0_0'],
              width: 12,
            },
          ],
          id: 'builtin_section-0',
          style: {
            backgroundColor: '#EAF0F6',
            backgroundType: 'CONTENT',
            paddingBottom: '10px',
            paddingTop: '10px',
          },
        },
      ],
    },
  },
  isRecipientFatigueSuppressionEnabled: false,
  leadFlowId: 1234,
  liveDomain: 'my-website.hs-sites.com',
  mailingListsExcluded: [1],
  mailingListsIncluded: [2],
  maxRssEntries: 5,
  metaDescription: '',
  pageExpirtyDate: 1234563463,
  pageExpiryRedirectId: 356,
  previewKey: 'abcDeGHY',
  processingStatus: 'UNDEFINED',
  publishDate: 12423432523,
  publishedAt: 143243253253,
  publishedById: 23,
  publishedByName: 'John Doe',
  publishImmediately: true,
  publishedUrl: '',
  replyTo: 'mail@gmail.com',
  resolvedDomain: 'ynet.com',
  rssEmailAuthorLineTemplate: 'By, ',
  rssEmailNlogImageMaxWidth: 300,
  rssEmailByTest: 'By',
  rssEmailClickThroughText: 'Read more',
  rssEmailCommentText: 'Comment',
  rssEmailEntryTemplate: '',
  rssEmailEntryTemplateEnabled: false,
  rssEmailUrl: '',
  rssToEmailTiming: {
    repeats: 'daily',
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_monthly: 1,
    // eslint-disable-next-line @typescript-eslint/camelcase
    repeats_on_weekly: 1,
    time: '9:00 am',
  },
  slug: 'slug-23412423423',
  smartEmailFields: {},
  styleSettings: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    background_color: '#EAF0F6',
  },
  subcategory: 'blog_email',
  subject: 'Subject line 2',
  subscription: 123456,
  subscriptionBlogId: 1234567890,
  // eslint-disable-next-line @typescript-eslint/camelcase
  subscription_name: 'Default HubSpot Blog Subscription',
  templatePath: 'generated_layouts/1345.html',
  trasactional: false,
  unpublishedAt: 0,
  updated: 1230005253,
  updatedById: 2,
  url: 'website-url.com',
  useRssHeadlineAsSubject: false,
  vidsExcluded: [1234],
  vidsIncluded: [12],
  widgets: {
    // eslint-disable-next-line @typescript-eslint/camelcase
    builtin_module_0_0_0: {
      body: {
        alignment: 'center',
        // eslint-disable-next-line @typescript-eslint/camelcase
        hs_enable_module_padding: true,
        img: {
          alt: 'HubSpot logo orange',
          height: 72,
          src: 'https://static.hsappstatic.net/TemplateAssets/static-1.46/img/hs_default_template_images/email_dnd_template_images/company-logo-orange.png',
          width: 240,
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        module_id: 1367093,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      child_css: {},
      css: {},
      id: 'builtin_module_0_0_0',
      // eslint-disable-next-line @typescript-eslint/camelcase
      module_id: 1367093,
      name: 'builtin_module_0_0_0',
      order: 1,
      type: 'module',
    },
  },
  workflowNames: [],
}

export const marketingEmailMockArray = [
  firstMarketingEmailMock,
  secondMarketingEmailMock,
  thirdMarketingEmailMock,
  marketingEmailMock,
]
