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
  isInstanceElement, isReferenceExpression, ReferenceExpression, CORE_ANNOTATIONS,
  TypeElement, isObjectType, getRestriction, StaticFile, isStaticFile, getChangeElement,
} from '@salto-io/adapter-api'
import {
  findElement,
  findObjectType, naclCase,
} from '@salto-io/adapter-utils'
import { MetadataInfo, RetrieveResult } from 'jsforce'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { testHelpers } from '../index'
import * as constants from '../src/constants'
import {
  INSTANCE_TYPE_FIELD, NESTED_INSTANCE_TYPE_NAME,
  transformFieldAnnotations,
} from '../src/filters/custom_objects'
import { STANDARD_VALUE_SET } from '../src/filters/standard_value_sets'
import { GLOBAL_VALUE_SET } from '../src/filters/global_value_sets'
import {
  CustomField, CustomObject, FieldPermissions, FilterItem, ObjectPermissions, ProfileInfo,
  TopicsForObjectsInfo,
} from '../src/client/types'
import {
  Types, metadataType, apiName, formulaTypeName, MetadataInstanceElement, MetadataTypeAnnotations,
} from '../src/transformers/transformer'
import realAdapter from './adapter'
import {
  findElements, findStandardFieldsObject, findAnnotationsObject, findCustomFieldsObject,
} from '../test/utils'
import SalesforceClient, { API_VERSION, Credentials } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import { toMetadataPackageZip, fromRetrieveResult } from '../src/transformers/xml_transformer'
import {
  objectExists, getMetadata, getMetadataFromElement, createInstance, removeElementAndVerify,
  removeElementIfAlreadyExists, createElementAndVerify, createElement, removeElement,
} from './utils'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'
import {
  accountApiName, auraInstanceValues, CUSTOM_FIELD_NAMES, customObjectAddFieldsName,
  customObjectWithFieldsName, gvsName, lightningComponentBundleInstanceValues,
  lwcHtmlResourceContent, lwcJsResourceContent, removeCustomObjectsWithVariousFields,
  staticResourceInstanceValues, summaryFieldName, verifyElementsExist,
} from './setup'

const { makeArray } = collections.array
const { PROFILE_METADATA_TYPE } = constants
const { isDefined } = lowerDashValues

const extractReferenceTo = (annotations: Values): (string | undefined)[] => (
  makeArray(annotations[constants.FIELD_ANNOTATIONS.REFERENCE_TO]).map(
    (ref: ReferenceExpression | string): string | undefined => (
      isReferenceExpression(ref)
        ? ref.elemId.typeName
        : ref
    )
  )
)

describe('Salesforce adapter E2E with real account', () => {
  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let credLease: CredsLease<Credentials>
  beforeAll(async () => {
    credLease = await testHelpers().credentials()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    adapter = adapterAttr.adapter
    client = adapterAttr.client
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let result: Element[]
  const apiNameAnno = (object: string, field: string): string => [
    object,
    field,
  ].join(constants.API_NAME_SEPARATOR)

  beforeAll(async () => {
    await verifyElementsExist(client)
    result = (await adapter.fetch()).elements
  })

  afterAll(async () => {
    await removeCustomObjectsWithVariousFields(client)
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
        expect(lead.fields.HasOptedOutOfEmail.type.elemID).toEqual(
          Types.primitiveDataTypes.Unknown.elemID
        )

        // Test label
        expect(lead.fields.Name.annotations[constants.LABEL]).toBe('Full Name')

        // Test true and false required
        expect(lead.fields.Description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(lead.fields.Company.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)

        // Test picklist restriction.enforce_value prop
        expect(lead.fields.Industry
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(false)
        expect(lead.fields.CleanStatus
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)

        // Test standard picklist values from a standard value set
        expect(lead.fields.LeadSource
          .annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(
          new ReferenceExpression(new ElemID(
            constants.SALESFORCE,
            STANDARD_VALUE_SET,
            'instance',
            'LeadSource',
          ))
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
          extractReferenceTo(lead.fields.OwnerId.annotations)
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
              businessProcess: new ReferenceExpression(
                new ElemID(constants.SALESFORCE, constants.BUSINESS_PROCESS_METADATA_TYPE,
                  'instance', 'Lead_TestBusinessProcess')
              ) })
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
      expect(getRestriction(flow.fields.processType).enforce_value).toEqual(false)
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

    it('should retrieve AuraDefinitionBundle instance', () => {
      const aura = findElements(result, 'AuraDefinitionBundle',
        'TestAuraDefinitionBundle')[0] as InstanceElement
      expect(aura.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestAuraDefinitionBundle')
      expect(isStaticFile(aura.value.styleContent)).toBe(true)
      const styleContentStaticFile = aura.value.styleContent as StaticFile
      expect(styleContentStaticFile.content).toEqual(Buffer.from('.THIS{\n}'))
      expect(styleContentStaticFile.filepath)
        .toEqual('salesforce/Records/AuraDefinitionBundle/TestAuraDefinitionBundle/TestAuraDefinitionBundle.css')
    })

    it('should retrieve LightningComponentBundle instance', () => {
      const lwc = findElements(result, 'LightningComponentBundle',
        'testLightningComponentBundle')[0] as InstanceElement
      expect(lwc.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('testLightningComponentBundle')
      const lwcResource = makeArray(lwc.value.lwcResources?.lwcResource)
        .find(resource => resource.filePath === 'lwc/testLightningComponentBundle/testLightningComponentBundle.js')
      expect(lwcResource).toBeDefined()
      expect(isStaticFile(lwcResource.source)).toBe(true)
      const lwcResourceStaticFile = lwcResource.source as StaticFile
      expect(lwcResourceStaticFile.content).toEqual(Buffer.from(lwcJsResourceContent))
      expect(lwcResourceStaticFile.filepath)
        .toEqual('salesforce/Records/LightningComponentBundle/testLightningComponentBundle/testLightningComponentBundle.js')
    })

    it('should retrieve StaticResource instance', () => {
      const staticResource = findElements(result, 'StaticResource',
        'TestStaticResource')[0] as InstanceElement
      expect(staticResource.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestStaticResource')
      expect(staticResource.value.contentType).toBe('text/xml')
      expect(isStaticFile(staticResource.value.content)).toBe(true)
      const contentStaticFile = staticResource.value.content as StaticFile
      expect(contentStaticFile.content).toEqual(Buffer.from('<xml/>'))
      expect(contentStaticFile.filepath)
        .toEqual('salesforce/Records/StaticResource/TestStaticResource.xml')
    })
  })

  describe('should perform CRUD operations', () => {
    // The following const method is a workaround for a bug in SFDC metadata API that returns
    // the fields in FieldPermissions and ObjectPermissions as string instead of boolean
    const verifyBoolean = (variable: string | boolean): boolean => (
      typeof variable === 'string' ? JSON.parse(variable) : variable)

    const getProfileInfo = async (profile: string): Promise<ProfileInfo> =>
      getMetadata(client, PROFILE_METADATA_TYPE, profile) as Promise<ProfileInfo>

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

      await removeElementIfAlreadyExists(client, instance)
      await createElementAndVerify(adapter, client, instance)
      await removeElementAndVerify(adapter, client, instance)
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
              [constants.LABEL]: { type: BuiltinTypes.STRING },
              type: { type: BuiltinTypes.STRING },
              displayFormat: { type: BuiltinTypes.STRING },
              startingNumber: { type: BuiltinTypes.NUMBER },
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
        },
        fields: {
          description: {
            type: stringType,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: '"test"',
              [constants.LABEL]: 'description label',
            },
          },
          formula: {
            type: stringType,
            annotations: {
              [constants.LABEL]: 'Test formula',
              [constants.FORMULA]: '"some text"',
            },
          },
        },
      })

      await removeElementIfAlreadyExists(client, element)
      const post = await createElement(adapter, element)

      // Test
      expect(post).toBeInstanceOf(ObjectType)
      expect(
        post.fields.description.annotations[constants.API_NAME]
      ).toBe('TestAddCustom__c.description__c')
      expect(
        post.fields.formula.annotations[constants.API_NAME]
      ).toBe('TestAddCustom__c.formula__c')

      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName,
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
      expect((await fieldPermissionExists(constants.ADMIN_PROFILE, [`${customObjectName}.description__c`]))[0]).toBe(true)
      expect((await objectPermissionExists(constants.ADMIN_PROFILE, [`${customObjectName}`]))[0]).toBe(true)

      // Clean-up
      await removeElement(adapter, post)
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
          description: {
            type: stringType,
            annotations: {
              [constants.LABEL]: 'test label',
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: '"test"',
            },
          },
        },
      })
      // Setup
      await createElementAndVerify(adapter, client, element)
      // Run and verify
      await removeElementAndVerify(adapter, client, element)
    })

    it('should modify an object by creating a new custom field and remove another one', async () => {
      const customObjectName = 'TestModifyCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify fields')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
            },
          },
          banana: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
            },
          },
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test',
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      await removeElementIfAlreadyExists(client, oldElement)
      const addResult = await createElement(adapter, oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName, ['Address__c', 'Banana__c'])).toBe(true)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          banana: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
            },
          },
          description: {
            type: stringType,
          },
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test2 label',
          [constants.API_NAME]: customObjectName,
        },
      })

      // Test
      const modificationResult = await adapter.deploy({
        groupID: oldElement.elemID.getFullName(),
        changes: [
          { action: 'add', data: { after: newElement.fields.description } },
          { action: 'remove', data: { before: oldElement.fields.address } },
        ],
      })

      expect(modificationResult.errors).toHaveLength(0)
      expect(modificationResult.appliedChanges).toHaveLength(1)
      expect(getChangeElement(modificationResult.appliedChanges[0])).toBeInstanceOf(ObjectType)
      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName, ['Banana__c', 'description__c'],
        ['Address__c'])).toBe(true)
      expect((await fieldPermissionExists(constants.ADMIN_PROFILE, [`${customObjectName}.description__c`]))[0]).toBe(true)
    })

    it('should modify an instance', async () => {
      const instanceElementName = 'TestProfileInstanceUpdate__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const oldInstance = new InstanceElement(instanceElementName, new ObjectType({
        elemID: mockElemID,
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

      await removeElementIfAlreadyExists(client, oldInstance)
      const post = await createElement(adapter, oldInstance)
      // const post = await adapter.add(oldInstance) as InstanceElement
      const updateResult = await adapter.deploy({
        groupID: newInstance.elemID.getFullName(),
        changes: [{ action: 'modify', data: { before: oldInstance, after: newInstance } }],
      })

      // Test
      expect(updateResult.errors).toHaveLength(0)
      expect(updateResult.appliedChanges).toHaveLength(1)
      expect(getChangeElement(updateResult.appliedChanges[0])).toStrictEqual(newInstance)

      // Checking that the saved instance identical to newInstance
      const savedInstance = await getMetadata(client, PROFILE_METADATA_TYPE,
        apiName(newInstance)) as Profile

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

      await removeElementAndVerify(adapter, client, post)
    })

    // This test should be removed and replace with an appropriate one as soon as SALTO-551 is done
    it('should not fetch tabVisibilities from profile', () => {
      const [adminProfile] = result
        .filter(isInstanceElement)
        .filter(e => metadataType(e) === PROFILE_METADATA_TYPE)
        .filter(e => apiName(e) === constants.ADMIN_PROFILE) as InstanceElement[]
      expect(adminProfile.value.tabVisibilities).toBeUndefined()
    })

    it("should modify an object's annotations", async () => {
      const customObjectName = 'TestModifyCustomAnnotations__c'
      const nameFieldType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'NameField'),
        fields: {
          [constants.LABEL]: { type: BuiltinTypes.STRING },
          type: { type: BuiltinTypes.STRING },
          displayFormat: { type: BuiltinTypes.STRING },
          startingNumber: { type: BuiltinTypes.NUMBER },
        },
      })
      const oldElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test modify annotations'),
        fields: {
          address: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [constants.LABEL]: 'Address',
            },
          },
          banana: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Banana__c'),
              [constants.LABEL]: 'Banana',
              [constants.BUSINESS_STATUS]: 'Active',
              [constants.SECURITY_CLASSIFICATION]: 'Public',
            },
          },
        },
        annotationTypes: {
          deploymentStatus: BuiltinTypes.STRING,
          nameField: nameFieldType,
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

      await removeElementIfAlreadyExists(client, oldElement)
      await createElementAndVerify(adapter, client, oldElement)

      const newElement = oldElement.clone()
      // Change field annotations
      Object.assign(
        newElement.fields.banana.annotations,
        {
          [constants.LABEL]: 'Banana Split',
          [constants.BUSINESS_STATUS]: 'Hidden',
          [constants.SECURITY_CLASSIFICATION]: 'Restricted',
          [constants.COMPLIANCE_GROUP]: 'GDPR',
        }
      )
      // Change type annotations
      Object.assign(
        newElement.annotations,
        {
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test label 2',
          deploymentStatus: 'Deployed',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'Text',
          },
        }
      )

      // Test
      const modificationResult = await adapter.deploy({
        groupID: newElement.elemID.getFullName(),
        changes: [
          {
            action: 'modify',
            data: {
              before: oldElement.fields.banana,
              after: newElement.fields.banana,
            },
          },
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ],
      })
      expect(modificationResult.errors).toHaveLength(0)
      expect(modificationResult.appliedChanges).toHaveLength(1)
      expect(getChangeElement(modificationResult.appliedChanges[0])).toBeInstanceOf(ObjectType)
      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName,
        undefined, undefined,
        {
          [constants.LABEL]: 'test label 2',
          deploymentStatus: 'Deployed',
          nameField: {
            [constants.LABEL]: customObjectName,
            type: 'Text',
          },
        })).toBe(true)
      const readResult = await getMetadata(client, constants.CUSTOM_OBJECT,
        customObjectName) as CustomObject

      const field = makeArray(readResult.fields).filter(f => f.fullName === 'Banana__c')[0]
      expect(field).toBeDefined()
      expect(field.label).toBe('Banana Split')
      expect(field.securityClassification).toBe('Restricted')
      expect(field.businessStatus).toBe('Hidden')
      expect(field.complianceGroup).toBe('GDPR')
    })

    it('should modify field and object annotation', async () => {
      const customObjectName = 'TestModifyFieldAndAnnotation__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify field and annotation')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: {
            type: stringType,
            annotations: {
              [constants.API_NAME]: apiNameAnno(customObjectName, 'Address__c'),
              [constants.LABEL]: 'Field Label',
            },
          },
        },
        annotations: {
          [constants.LABEL]: 'Object Label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      await removeElementIfAlreadyExists(client, oldElement)
      await createElementAndVerify(adapter, client, oldElement)

      const newElement = oldElement.clone()
      newElement.annotations.label = 'Object Updated Label'
      newElement.fields.address.annotations.label = 'Field Updated Label'

      // Test
      const modificationResult = await adapter.deploy({
        groupID: newElement.elemID.getFullName(),
        changes: [
          {
            action: 'modify',
            data: { before: oldElement.fields.address, after: newElement.fields.address },
          },
          { action: 'modify', data: { before: oldElement, after: newElement } },
        ],
      })
      expect(modificationResult.errors).toHaveLength(0)
      expect(modificationResult.appliedChanges).toHaveLength(1)
      expect(getChangeElement(modificationResult.appliedChanges[0])).toBeInstanceOf(ObjectType)

      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName,
        undefined, undefined, { [constants.LABEL]: 'Object Updated Label' }))
        .toBeTruthy()
      const addressFieldInfo = await getMetadata(client, constants.CUSTOM_FIELD,
        apiNameAnno(customObjectName, 'Address__c')) as CustomField
      expect(addressFieldInfo.label).toEqual('Field Updated Label')
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
          .toEqual(CUSTOM_FIELD_NAMES.PICKLIST)
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
        expect(extractReferenceTo(annotations)).toEqual(['Opportunity'])
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
        expect(extractReferenceTo(annotations)).toEqual(['Case'])
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
              fields[CUSTOM_FIELD_NAMES.CURRENCY],
              testCurrency,
              Types.primitiveDataTypes.Currency
            )
          })

          it('autonumber', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.AUTO_NUMBER],
              testAutoNumber,
              Types.primitiveDataTypes.AutoNumber
            )
          })

          it('date', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.DATE],
              testDate,
              Types.primitiveDataTypes.Date
            )
          })

          it('time', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.TIME],
              testTime,
              Types.primitiveDataTypes.Time
            )
          })

          it('datetime', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.DATE_TIME],
              testDatetime,
              Types.primitiveDataTypes.DateTime
            )
          })

          it('email', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.EMAIL],
              testEmail,
              Types.primitiveDataTypes.Email
            )
          })

          it('location', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.LOCATION],
              testLocation,
              Types.compoundDataTypes.Location
            )
          })

          it('picklist', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.PICKLIST],
              testPicklist,
              Types.primitiveDataTypes.Picklist
            )
          })

          it('global picklist', () => {
            const field = fields[CUSTOM_FIELD_NAMES.GLOBAL_PICKLIST]
            verifyFieldFetch(field, testGlobalPicklist, Types.primitiveDataTypes.Picklist)
            expect(field.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME])
              .toEqual(new ReferenceExpression(
                new ElemID(
                  constants.SALESFORCE,
                  naclCase(GLOBAL_VALUE_SET),
                  'instance',
                  naclCase(gvsName),
                )
              ))
          })

          it('multipicklist', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.MULTI_PICKLIST],
              testMultiSelectPicklist,
              Types.primitiveDataTypes.MultiselectPicklist
            )
          })

          it('percent', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.PERCENT],
              testPercent,
              Types.primitiveDataTypes.Percent
            )
          })

          it('phone', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.PHONE],
              testPhone,
              Types.primitiveDataTypes.Phone
            )
          })

          it('long text area', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.LONG_TEXT_AREA],
              testLongTextArea,
              Types.primitiveDataTypes.LongTextArea
            )
          })

          it('rich text area', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.RICH_TEXT_AREA],
              testRichTextArea,
              Types.primitiveDataTypes.Html
            )
          })

          it('text area', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.TEXT_AREA],
              testTextArea,
              Types.primitiveDataTypes.TextArea
            )
          })

          it('encrypted text', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.ENCRYPTED_TEXT],
              testEncryptedText,
              Types.primitiveDataTypes.EncryptedText
            )
          })

          it('url', () => {
            verifyFieldFetch(fields[CUSTOM_FIELD_NAMES.URL], testUrl, Types.primitiveDataTypes.Url)
          })

          it('number', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.NUMBER],
              testNumber,
              Types.primitiveDataTypes.Number
            )
          })

          it('text', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.TEXT],
              testText,
              Types.primitiveDataTypes.Text
            )
          })

          it('checkbox', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.CHECKBOX],
              testCheckbox,
              Types.primitiveDataTypes.Checkbox
            )
          })

          it('lookup', () => {
            const field = fields[CUSTOM_FIELD_NAMES.LOOKUP]
            verifyFieldFetch(field, testLookup, Types.primitiveDataTypes.Lookup)
            expect(field.annotations[constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION])
              .toBe(false)
          })

          it('master-detail', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.MASTER_DETAIL],
              testMasterDetail,
              Types.primitiveDataTypes.MasterDetail,
            )
          })

          it('rollup summary', () => {
            const field = (findElements(result, 'Account') as ObjectType[])
              .find(a => a.fields[CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY])
              ?.fields[CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY] as Field
            verifyFieldFetch(field, testSummary, Types.primitiveDataTypes.Summary)
          })

          it('formula', () => {
            verifyFieldFetch(
              fields[CUSTOM_FIELD_NAMES.FORMULA],
              testFormula,
              Types.formulaDataTypes[
                formulaTypeName(constants.FIELD_TYPE_NAMES.CHECKBOX)
              ]
            )
          })
        })
      })

      describe('add', () => {
        const testAddFieldPrefix = 'TestAdd'
        const mockElemID = new ElemID(constants.SALESFORCE, 'test add object with field types')
        let customFieldsObject: ObjectType
        let post: ObjectType
        let objectInfo: CustomObject

        beforeAll(async () => {
          customFieldsObject = findCustomFieldsObject(result, customObjectWithFieldsName)
          const newCustomObject = new ObjectType({
            elemID: mockElemID,
            fields: _(customFieldsObject.fields)
              .mapKeys((_field, name) => (
                [CUSTOM_FIELD_NAMES.MASTER_DETAIL, CUSTOM_FIELD_NAMES.LOOKUP].includes(name)
                  ? `${testAddFieldPrefix}${name}`
                  : name
              ))
              .mapValues((field, name) => {
                const annotations = _.cloneDeep(field.annotations)
                annotations[constants.API_NAME] = `${customObjectAddFieldsName}.${name}`

                if (name === CUSTOM_FIELD_NAMES.MULTI_PICKLIST) {
                  annotations[constants.VALUE_SET_DEFINITION_FIELDS.SORTED] = true
                }
                return { type: field.type, annotations }
              })
              .value(),
            annotations: {
              [constants.API_NAME]: customObjectAddFieldsName,
              [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            },
          })

          // Resolve reference expression before deploy
          const normalizeReference = (
            ref: ReferenceExpression | string | undefined
          ): string | undefined => {
            if (isReferenceExpression(ref)) {
              const elem = findElement(result, ref.elemId)
              return elem
                // adding fallback for partially-resolved elements
                ? apiName(elem) || elem.elemID.typeName
                : undefined
            }
            return ref
          }

          const potentialReferenceAnnotations = [
            constants.VALUE_SET_FIELDS.VALUE_SET_NAME,
            constants.FIELD_ANNOTATIONS.REFERENCE_TO,
          ]
          potentialReferenceAnnotations.forEach(annotationName => {
            Object.values(newCustomObject.fields)
              .filter(f => makeArray(f.annotations[annotationName]).some(isReferenceExpression))
              .forEach(f => {
                f.annotations[annotationName] = Array.isArray(f.annotations[annotationName])
                  ? f.annotations[annotationName].map(normalizeReference).filter(isDefined)
                  : normalizeReference(f.annotations[annotationName])
              })
          })

          await removeElementIfAlreadyExists(client, customFieldsObject)
          post = await createElement(adapter, newCustomObject)
          objectInfo = await getMetadata(client, constants.CUSTOM_OBJECT,
            customObjectAddFieldsName) as CustomObject
        })

        it('custom object', async () => {
          expect(post).toBeDefined()
        })

        describe('fields', () => {
          let fields: Values
          const masterDetailApiName = `${testAddFieldPrefix}${CUSTOM_FIELD_NAMES.MASTER_DETAIL}`
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
              fields[CUSTOM_FIELD_NAMES.CURRENCY],
              testCurrency,
              constants.FIELD_TYPE_NAMES.CURRENCY
            )
          })

          it('autonumber', async () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.AUTO_NUMBER],
              testAutoNumber,
              constants.FIELD_TYPE_NAMES.AUTONUMBER
            )
          })

          it('date', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.DATE],
              testDate,
              constants.FIELD_TYPE_NAMES.DATE
            )
          })

          it('time', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.TIME],
              testTime,
              constants.FIELD_TYPE_NAMES.TIME
            )
          })

          it('datetime', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.DATE_TIME],
              testDatetime,
              constants.FIELD_TYPE_NAMES.DATETIME
            )
          })

          it('email', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.EMAIL],
              testEmail,
              constants.FIELD_TYPE_NAMES.EMAIL
            )
          })

          it('location', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.LOCATION],
              testLocation,
              constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
            )
          })

          it('picklist', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.PICKLIST],
              testPicklist,
              constants.FIELD_TYPE_NAMES.PICKLIST
            )
          })

          it('multipicklist', () => {
            const testMultiSelectPicklistAdd = (annotations: Values): void =>
              testMultiSelectPicklist(annotations, true)
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.MULTI_PICKLIST],
              testMultiSelectPicklistAdd,
              constants.FIELD_TYPE_NAMES.MULTIPICKLIST
            )
          })

          it('global picklist', () => {
            const field = fields[CUSTOM_FIELD_NAMES.GLOBAL_PICKLIST]
            verifyFieldAddition(
              field,
              testGlobalPicklist,
              constants.FIELD_TYPE_NAMES.PICKLIST
            )
            expect(field[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(gvsName)
          })

          it('percent', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.PERCENT],
              testPercent,
              constants.FIELD_TYPE_NAMES.PERCENT
            )
          })

          it('phone', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.PHONE],
              testPhone,
              constants.FIELD_TYPE_NAMES.PHONE
            )
          })

          it('long text area', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.LONG_TEXT_AREA],
              testLongTextArea,
              constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
            )
          })

          it('rich text area', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.RICH_TEXT_AREA],
              testRichTextArea,
              constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
            )
          })

          it('text area', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.TEXT_AREA],
              testTextArea,
              constants.FIELD_TYPE_NAMES.TEXTAREA
            )
          })

          it('encrypted text', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.ENCRYPTED_TEXT],
              testEncryptedText,
              constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
            )
          })

          it('url', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.URL],
              testUrl,
              constants.FIELD_TYPE_NAMES.URL
            )
          })

          it('number', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.NUMBER],
              testNumber,
              constants.FIELD_TYPE_NAMES.NUMBER
            )
          })

          it('text', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.TEXT],
              testText,
              constants.FIELD_TYPE_NAMES.TEXT
            )
          })

          it('checkbox', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.CHECKBOX],
              testCheckbox,
              constants.FIELD_TYPE_NAMES.CHECKBOX
            )
          })

          it('lookup', () => {
            const fieldName = `${testAddFieldPrefix}${CUSTOM_FIELD_NAMES.LOOKUP}`
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
            const rollupSummaryFieldName = summaryFieldName.split('.')[1]

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

            let origCase = findCustomCase()

            const removeRollupSummaryFieldFromCase = async (caseObj: ObjectType, fieldName: string):
              Promise<ObjectType> => {
              const caseAfterFieldRemoval = caseObj.clone()
              delete caseAfterFieldRemoval.fields[fieldName]
              await adapter.deploy({
                groupID: caseObj.elemID.getFullName(),
                changes: [{ action: 'remove', data: { before: caseObj.fields[fieldName] } }],
              })
              return caseAfterFieldRemoval
            }
            if (await objectExists(client, constants.CUSTOM_OBJECT, 'Case', [rollupSummaryFieldName])) {
              origCase = await removeRollupSummaryFieldFromCase(origCase, rollupSummaryFieldName)
            }

            const addRollupSummaryField = async (): Promise<ObjectType> => {
              const caseAfterFieldAddition = origCase.clone()
              caseAfterFieldAddition.fields[rollupSummaryFieldName] = new Field(
                caseAfterFieldAddition,
                rollupSummaryFieldName,
                Types.primitiveDataTypes.Summary,
                {
                  [CORE_ANNOTATIONS.REQUIRED]: false,
                  [constants.LABEL]: 'Summary label',
                  [constants.API_NAME]: apiNameAnno('Case', rollupSummaryFieldName),
                  [constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: `${customObjectAddFieldsName}.${CUSTOM_FIELD_NAMES.CURRENCY}`,
                  [constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: `${customObjectAddFieldsName}.${masterDetailApiName}`,
                  [constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'max',
                  [constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [
                    {
                      [constants.FILTER_ITEM_FIELDS.FIELD]: `${customObjectAddFieldsName}.${CUSTOM_FIELD_NAMES.CURRENCY}`,
                      [constants.FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
                      [constants.FILTER_ITEM_FIELDS.VALUE]: '1',
                    },
                  ],
                }
              )
              await adapter.deploy({
                groupID: origCase.elemID.getFullName(),
                changes: [{
                  action: 'add',
                  data: { after: caseAfterFieldAddition.fields[rollupSummaryFieldName] },
                }],
              })
              return caseAfterFieldAddition
            }
            const verifyRollupSummaryField = async (): Promise<void> => {
              const fetchedRollupSummary = await getMetadata(client, constants.CUSTOM_FIELD,
                `Case.${rollupSummaryFieldName}`) as CustomField
              expect(_.get(fetchedRollupSummary, 'summarizedField'))
                .toEqual(`${customObjectAddFieldsName}.${CUSTOM_FIELD_NAMES.CURRENCY}`)
              expect(_.get(fetchedRollupSummary, 'summaryForeignKey'))
                .toEqual(`${customObjectAddFieldsName}.${masterDetailApiName}`)
              expect(_.get(fetchedRollupSummary, 'summaryOperation')).toEqual('max')
              expect(fetchedRollupSummary.summaryFilterItems).toBeDefined()
              const filterItems = fetchedRollupSummary.summaryFilterItems as FilterItem
              expect(filterItems.field).toEqual(`${customObjectAddFieldsName}.${CUSTOM_FIELD_NAMES.CURRENCY}`)
              expect(filterItems.operation).toEqual('greaterThan')
              expect(filterItems.value).toEqual('1')
            }

            const caseAfterFieldAddition = await addRollupSummaryField()
            await verifyRollupSummaryField()
            await removeRollupSummaryFieldFromCase(caseAfterFieldAddition, rollupSummaryFieldName)
          })

          it('formula', () => {
            verifyFieldAddition(
              fields[CUSTOM_FIELD_NAMES.FORMULA],
              testFormula,
              constants.FIELD_TYPE_NAMES.CHECKBOX
            )
          })
        })
      })

      describe('update', () => {
        let objectInfo: CustomObject

        const fieldNamesToAnnotations: Record<string, Values> = {
          [CUSTOM_FIELD_NAMES.CURRENCY]: {
            [constants.LABEL]: 'Currency label Updated',
            [constants.DESCRIPTION]: 'Currency description Updated',
            [constants.HELP_TEXT]: 'Currency help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.SCALE]: 4,
            [constants.FIELD_ANNOTATIONS.PRECISION]: 17,
            [constants.DEFAULT_VALUE_FORMULA]: '24',
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.CURRENCY,
          },
          [CUSTOM_FIELD_NAMES.AUTO_NUMBER]: {
            [constants.LABEL]: 'AutoNumber label Updated',
            [constants.DESCRIPTION]: 'AutoNumber description Updated',
            [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'QQQ-{0000}',
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.AUTONUMBER,
          },
          [CUSTOM_FIELD_NAMES.DATE]: {
            [constants.LABEL]: 'Date label Updated',
            [constants.DESCRIPTION]: 'Date description Updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.DATE,
          },
          [CUSTOM_FIELD_NAMES.TIME]: {
            [constants.LABEL]: 'Time label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TIME,
          },
          [CUSTOM_FIELD_NAMES.DATE_TIME]: {
            [constants.LABEL]: 'DateTime label Updated',
            [constants.DESCRIPTION]: 'DateTime description Updated',
            [constants.HELP_TEXT]: 'DateTime help updated',
            [constants.BUSINESS_STATUS]: 'Hidden',
            [constants.SECURITY_CLASSIFICATION]: 'Restricted',
            [constants.COMPLIANCE_GROUP]: 'GDPR',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.DATETIME,
          },
          [CUSTOM_FIELD_NAMES.PICKLIST]: {
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
          [CUSTOM_FIELD_NAMES.MULTI_PICKLIST]: {
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
          [CUSTOM_FIELD_NAMES.EMAIL]: {
            [constants.LABEL]: 'Email label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.FIELD_ANNOTATIONS.UNIQUE]: false,
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.EMAIL,
          },
          [CUSTOM_FIELD_NAMES.LOCATION]: {
            [constants.LABEL]: 'Location label Updated',
            [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: false,
            [constants.FIELD_ANNOTATIONS.SCALE]: 10,
            [constants.BUSINESS_STATUS]: 'Active',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION,
          },
          [CUSTOM_FIELD_NAMES.PERCENT]: {
            [constants.LABEL]: 'Percent label Updated',
            [constants.DESCRIPTION]: 'Percent description Updated',
            [constants.HELP_TEXT]: 'Percent help updated',
            [constants.FIELD_ANNOTATIONS.SCALE]: 7,
            [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PERCENT,
          },
          [CUSTOM_FIELD_NAMES.PHONE]: {
            [constants.LABEL]: 'Phone label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PHONE,
          },
          [CUSTOM_FIELD_NAMES.LONG_TEXT_AREA]: {
            [constants.LABEL]: 'LongTextArea label Updated',
            [constants.DESCRIPTION]: 'LongTextArea description Updated',
            [constants.FIELD_ANNOTATIONS.LENGTH]: 32000,
            [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.LONGTEXTAREA,
          },
          [CUSTOM_FIELD_NAMES.RICH_TEXT_AREA]: {
            [constants.LABEL]: 'RichTextArea label Updated',
            [constants.HELP_TEXT]: 'RichTextArea help updated',
            [constants.FIELD_ANNOTATIONS.LENGTH]: 32000,
            [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 10,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.RICHTEXTAREA,
          },
          [CUSTOM_FIELD_NAMES.TEXT_AREA]: {
            [constants.LABEL]: 'TextArea label Updated',
            [constants.DESCRIPTION]: 'TextArea description Updated',
            [constants.HELP_TEXT]: 'TextArea help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TEXTAREA,
          },
          [CUSTOM_FIELD_NAMES.ENCRYPTED_TEXT]: {
            [constants.LABEL]: 'EncryptedText label Updated',
            [constants.DESCRIPTION]: 'EncryptedText description Updated',
            [constants.HELP_TEXT]: 'EncryptedText help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.LENGTH]: 100,
            [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
            [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'ssn',
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
          },
          [CUSTOM_FIELD_NAMES.URL]: {
            [constants.LABEL]: 'Url label Updated',
            [constants.DESCRIPTION]: 'Url description Updated',
            [constants.HELP_TEXT]: 'Url help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.URL,
          },
          [CUSTOM_FIELD_NAMES.NUMBER]: {
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
          [CUSTOM_FIELD_NAMES.TEXT]: {
            [constants.LABEL]: 'Text label Updated',
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.FIELD_ANNOTATIONS.LENGTH]: 99,
            [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            [constants.FIELD_ANNOTATIONS.EXTERNAL_ID]: false,
            [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.TEXT,
          },
          [CUSTOM_FIELD_NAMES.CHECKBOX]: {
            [constants.LABEL]: 'Checkbox label Updated',
            [constants.DESCRIPTION]: 'Checkbox description Updated',
            [constants.HELP_TEXT]: 'Checkbox help updated',
            [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: false,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.CHECKBOX,
          },
          [CUSTOM_FIELD_NAMES.GLOBAL_PICKLIST]: {
            [constants.LABEL]: 'GlobalPicklist label Updated',
            [constants.DESCRIPTION]: 'GlobalPicklist description Updated',
            [constants.HELP_TEXT]: 'GlobalPicklist help updated',
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
            [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: gvsName,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.PICKLIST,
          },
          [CUSTOM_FIELD_NAMES.LOOKUP]: {
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
          },
          [CUSTOM_FIELD_NAMES.MASTER_DETAIL]: {
            [constants.LABEL]: 'MasterDetail label Updated',
            [constants.DESCRIPTION]: 'MasterDetail description Updated',
            [constants.HELP_TEXT]: 'MasterDetail help updated',
            [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
            [constants.FIELD_ANNOTATIONS.RELATIONSHIP_NAME]: CUSTOM_FIELD_NAMES.MASTER_DETAIL
              .split(constants.SALESFORCE_CUSTOM_SUFFIX)[0],
            [constants.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: false,
            [constants.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: false,
            [constants.FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]: 0,
            [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
          },
          [CUSTOM_FIELD_NAMES.FORMULA]: {
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
          await adapter.deploy({
            groupID: customFieldsObject.elemID.getFullName(),
            changes: Object.keys(fieldNamesToAnnotations)
              .map(f => ({
                action: 'modify',
                data: { before: customFieldsObject.fields[f], after: newCustomObject.fields[f] },
              })),
          })
          objectInfo = await getMetadata(client, constants.CUSTOM_OBJECT,
            customObjectWithFieldsName) as CustomObject
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
            expect(field[INSTANCE_TYPE_FIELD]).toEqual(expectedType)
            expect(field).toEqual(expectedAnnotations ?? fieldNamesToAnnotations[name])
          }

          it('currency', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.CURRENCY, constants.FIELD_TYPE_NAMES.CURRENCY)
          })

          it('autonumber', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.AUTO_NUMBER, constants.FIELD_TYPE_NAMES.AUTONUMBER)
          })

          it('date', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.DATE, constants.FIELD_TYPE_NAMES.DATE)
          })

          it('time', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.TIME, constants.FIELD_TYPE_NAMES.TIME)
          })

          it('dateTime', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.DATE_TIME, constants.FIELD_TYPE_NAMES.DATETIME)
          })

          it('picklist', async () => {
            const annotations = fieldNamesToAnnotations[CUSTOM_FIELD_NAMES.PICKLIST]
            annotations[constants.VALUE_SET_DEFINITION_FIELDS.SORTED] = false
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.PICKLIST,
              constants.FIELD_TYPE_NAMES.PICKLIST,
              annotations
            )
          })

          it('multipicklist', async () => {
            const annotations = fieldNamesToAnnotations[CUSTOM_FIELD_NAMES.MULTI_PICKLIST]
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
              CUSTOM_FIELD_NAMES.MULTI_PICKLIST,
              constants.FIELD_TYPE_NAMES.MULTIPICKLIST,
              annotations
            )
          })

          it('global picklist', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.GLOBAL_PICKLIST,
              constants.FIELD_TYPE_NAMES.PICKLIST
            )
          })

          it('email', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.EMAIL, constants.FIELD_TYPE_NAMES.EMAIL)
          })

          it('location', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.LOCATION,
              constants.COMPOUND_FIELD_TYPE_NAMES.LOCATION
            )
          })

          it('percent', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.PERCENT, constants.FIELD_TYPE_NAMES.PERCENT)
          })

          it('phone', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.PHONE, constants.FIELD_TYPE_NAMES.PHONE)
          })

          it('long text area', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.LONG_TEXT_AREA,
              constants.FIELD_TYPE_NAMES.LONGTEXTAREA
            )
          })

          it('rich text area', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.RICH_TEXT_AREA,
              constants.FIELD_TYPE_NAMES.RICHTEXTAREA
            )
          })

          it('text area', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.TEXT_AREA,
              constants.FIELD_TYPE_NAMES.TEXTAREA
            )
          })

          it('encrypted text', async () => {
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.ENCRYPTED_TEXT,
              constants.FIELD_TYPE_NAMES.ENCRYPTEDTEXT
            )
          })

          it('url', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.URL, constants.FIELD_TYPE_NAMES.URL)
          })

          it('number', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.NUMBER, constants.FIELD_TYPE_NAMES.NUMBER)
          })

          it('text', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.TEXT, constants.FIELD_TYPE_NAMES.TEXT)
          })

          it('checkbox', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.CHECKBOX, constants.FIELD_TYPE_NAMES.CHECKBOX)
          })

          it('formula', async () => {
            verifyFieldUpdate(CUSTOM_FIELD_NAMES.FORMULA, constants.FIELD_TYPE_NAMES.CHECKBOX)
          })

          it('lookup', async () => {
            const annotations = fieldNamesToAnnotations[CUSTOM_FIELD_NAMES.LOOKUP]
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.LOOKUP,
              constants.FIELD_TYPE_NAMES.LOOKUP,
              _.omit(annotations, constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION)
            )
            expect(makeArray(objectInfo?.fields)
              .find(f => f.fullName === CUSTOM_FIELD_NAMES.LOOKUP)?.deleteConstraint)
              .toEqual('SetNull')
          })

          it('master-detail', async () => {
            const annotations = fieldNamesToAnnotations[CUSTOM_FIELD_NAMES.MASTER_DETAIL]
            verifyFieldUpdate(
              CUSTOM_FIELD_NAMES.MASTER_DETAIL,
              constants.FIELD_TYPE_NAMES.MASTER_DETAIL,
              _.omit(annotations, constants.FIELD_ANNOTATIONS.RELATIONSHIP_NAME)
            )
          })

          it('rollup summary', async () => {
            const fullName = `${accountApiName}.${CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY}`
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
            }
            const account = (findElements(result, 'Account') as ObjectType[])
              .find(a => a.fields[CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY]) as ObjectType
            expect(account).toBeDefined()
            const updatedAccount = account.clone()
            const field = account.fields[CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY]
            const updatedField = updatedAccount.fields[CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY]
            updatedField.annotations = annotations
            await adapter.deploy({
              groupID: account.elemID.getFullName(),
              changes: [{ action: 'modify', data: { before: field, after: updatedField } }],
            })
            const fieldInfo = await getMetadata(client, constants.CUSTOM_FIELD,
              fullName) as CustomField
            expect(fieldInfo[constants.INSTANCE_FULL_NAME_FIELD])
              .toEqual(`${accountApiName}.${CUSTOM_FIELD_NAMES.ROLLUP_SUMMARY}`)
            delete fieldInfo[constants.INSTANCE_FULL_NAME_FIELD]
            expect(Object.assign(
              transformFieldAnnotations(fieldInfo, accountApiName),
              { [INSTANCE_TYPE_FIELD]: constants.FIELD_TYPE_NAMES.ROLLUP_SUMMARY }
            )).toEqual(_.omit(annotations, constants.API_NAME))
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
      ].join(constants.API_NAME_SEPARATOR)
      const oldElement = new ObjectType({
        elemID: mockElemID,
        fields: { [fieldName]: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
            [constants.API_NAME]: lookupFieldApiFullName,
            [constants.LABEL]: fieldName,
            [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: [
              'Case',
            ],
          },
        } },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      await removeElementIfAlreadyExists(client, oldElement)
      const addResult = await createElement(adapter, oldElement)
      // Verify setup was performed properly
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName,
        [lookupFieldApiName])).toBe(true)

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: { [fieldName]: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
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
          },
        } },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      // Test
      const modificationResult = await adapter.deploy({
        groupID: oldElement.elemID.getFullName(),
        changes: [{
          action: 'modify',
          data: { before: oldElement.fields[fieldName], after: newElement.fields[fieldName] },
        }],
      })
      expect(modificationResult.errors).toHaveLength(0)
      expect(modificationResult.appliedChanges).toHaveLength(1)
      expect(getChangeElement(modificationResult.appliedChanges[0])).toBeInstanceOf(ObjectType)

      // Verify the lookup filter was created
      const customObject = await client.describeSObjects([customObjectName])
      expect(customObject[0]).toBeDefined()
      const lookupField = customObject[0].fields
        .filter(field => field.name === lookupFieldApiName)[0]
      expect(lookupField).toBeDefined()
      expect(lookupField.filteredLookupInfo).toBeDefined()

      // Clean-up
      await removeElement(adapter, oldElement)
    })

    it('should add default TopicsForObjects values', async () => {
      const customObjectName = 'TestAddDefaultTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add default topic for objects')
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      await removeElementIfAlreadyExists(client, element)
      const addResult = await createElement(adapter, element)
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(addResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(false)
    })

    it('should add element TopicsForObjects value', async () => {
      const customObjectName = 'TestAddElementTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add element topic for objects')
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.TOPICS_FOR_OBJECTS_ANNOTATION]: { [constants
            .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]: true },
        },
      })

      await removeElementIfAlreadyExists(client, element)
      const addResult = await createElement(adapter, element)
      expect(addResult).toBeInstanceOf(ObjectType)
      expect(addResult.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(true)

      // Checks if the new topic' object exists
      const results = (await client.readMetadata(constants.TOPICS_FOR_OBJECTS_METADATA_TYPE,
        apiName(addResult))).result as TopicsForObjectsInfo[]
      expect(results).toHaveLength(1)
      expect(results[0].enableTopics).toBe('true')
    })

    it('should update TopicsForObjects field', async () => {
      const customObjectName = 'TestUpdateTopicsForObjects__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add topic for objects')
      const oldElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.LABEL]: 'test label',
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      await removeElementIfAlreadyExists(client, oldElement)
      const addResult = await createElement(adapter, oldElement)
      // Verify setup was performed properly
      expect(await objectExists(client, constants.CUSTOM_OBJECT, customObjectName)).toBe(true)
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
      const modificationResult = await adapter.deploy({
        groupID: oldElement.elemID.getFullName(),
        changes: [{ action: 'modify', data: { before: oldElement, after: newElement } }],
      })

      const updatedElement = getChangeElement(modificationResult.appliedChanges[0])

      // Verify the enable topics was changed correctly
      expect(updatedElement).toBeInstanceOf(ObjectType)
      expect(updatedElement.annotations[constants.TOPICS_FOR_OBJECTS_ANNOTATION][constants
        .TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS]).toBe(true)

      // Clean-up
      await removeElement(adapter, oldElement)
    })

    // Assignment rules are special because they use the Deploy API so they get their own test
    describe('assignment rules manipulation', () => {
      const assignmentRulesTypeName = 'AssignmentRules'
      const getRulesFromClient = async (): Promise<Values> =>
        getMetadata(client, assignmentRulesTypeName, 'Lead') as Promise<Values>

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
        after = before.clone()
      })

      it('should create and remove rule', async () => {
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

        await adapter.deploy({
          groupID: before.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before, after } }],
        })

        const updatedRules = await getRulesFromClient()
        // Since assignment rules order is not relevant so we have to compare sets
        expect(new Set(updatedRules.assignmentRule)).toEqual(new Set(after.value.assignmentRule))

        // Remove the new rule
        await adapter.deploy({
          groupID: before.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before: after, after: before } }],
        })
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

        await adapter.deploy({
          groupID: before.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before, after } }],
        })

        const updatedRules = await getRulesFromClient()
        expect(updatedRules).toEqual(after.value)
        await adapter.deploy({
          groupID: before.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before: after, after: before } }],
        })
      })
    })

    describe('deploy retrieve manipulations', () => {
      describe('types that support only retrieve & deploy', () => {
        const packageName = 'unpackaged'
        const retrieve = async (type: string, member: string): Promise<RetrieveResult> => {
          const retrieveRequest = {
            apiVersion: API_VERSION,
            singlePackage: false,
            [packageName]: [{ types: { name: type, members: member } }],
          }
          return client.retrieve(retrieveRequest)
        }

        const findInstance = async (instance: MetadataInstanceElement):
          Promise<MetadataInfo | undefined> => {
          const type = metadataType(instance)
          const retrieveResult = await retrieve(type, apiName(instance))
          // In the real code we pass in the fileProps from the request because there is an issue
          // where sometimes fileProps from the response have an empty fullName
          // this means that here we need to remove the package name from the file path to simulate
          // how we would have gotten the file props from listMetadataObjects
          const fileProps = makeArray(retrieveResult.fileProperties)
            .map(props => ({ ...props, fileName: props.fileName.slice(packageName.length + 1) }))
          const instances = await fromRetrieveResult(
            retrieveResult,
            fileProps,
            new Set(instance.type.annotations.hasMetaFile ? [type] : []),
            new Set(constants.METADATA_CONTENT_FIELD in instance.value ? [type] : []),
          )
          return instances
            .filter(({ file }) => file.fullName === apiName(instance))
            .map(({ values }) => values)
            .pop()
        }

        const removeIfAlreadyExists = async (instance: MetadataInstanceElement): Promise<void> => {
          if (await findInstance(instance)) {
            await client.deploy(await toMetadataPackageZip(instance, true) as Buffer)
          }
        }

        const getContentFromStaticFileOrString = (content: string | StaticFile): string => (
          isStaticFile(content) ? (content.content as Buffer).toString() : content)

        const verifyCreateInstance = async (instance: MetadataInstanceElement): Promise<void> => {
          await createElement(adapter, instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
          const content = getContentFromStaticFileOrString(_.get(instanceInfo, 'content'))
          expect(content.includes('Created')).toBeTruthy()
        }

        const verifyUpdateInstance = async (instance: MetadataInstanceElement): Promise<void> => {
          const after = instance.clone()
          const contentString = getContentFromStaticFileOrString(after.value.content).replace('Created', 'Updated')
          after.value.content = isStaticFile(after.value.content)
            ? new StaticFile({
              filepath: after.value.content.filepath,
              content: Buffer.from(contentString),
            })
            : contentString
          await adapter.deploy({
            groupID: instance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: instance, after } }],
          })
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeDefined()
          expect(getContentFromStaticFileOrString(_.get(instanceInfo, 'content')).includes('Updated')).toBeTruthy()
        }

        const verifyRemoveInstance = async (instance: MetadataInstanceElement): Promise<void> => {
          await removeElement(adapter, instance)
          const instanceInfo = await findInstance(instance)
          expect(instanceInfo).toBeUndefined()
        }

        const createInstanceElement = (
          fullName: string,
          typeName: string,
          content: string | Value,
          typeAnnotations: Partial<MetadataTypeAnnotations> = {},
        ): MetadataInstanceElement => {
          const objectType = new ObjectType({
            elemID: new ElemID(constants.SALESFORCE, typeName),
            annotations: {
              [constants.METADATA_TYPE]: typeName,
              ...typeAnnotations,
            },
          })
          return new InstanceElement(
            fullName,
            objectType,
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
              apiVersion: API_VERSION,
              content,
            }
          ) as MetadataInstanceElement
        }

        describe('apex class manipulation', () => {
          const apexClassInstance = createInstanceElement('MyApexClass', 'ApexClass',
            new StaticFile({
              filepath: 'ApexClass.cls',
              content: Buffer.from('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}'),
            }),
            { hasMetaFile: true })

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
            new StaticFile({
              filepath: 'MyApexTrigger.trigger',
              content: Buffer.from('trigger MyApexTrigger on Account (before insert) {\n    System.debug(\'Created\');\n}'),
            }),
            { hasMetaFile: true })

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
            new StaticFile({
              filepath: 'ApexPage.page',
              content: Buffer.from('<apex:page>Created by e2e test!</apex:page>'),
            }),
            { hasMetaFile: true })
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
            new StaticFile({
              filepath: 'MyApexComponent.component',
              content: Buffer.from('<apex:component >Created by e2e test!</apex:component>'),
            }),
            { hasMetaFile: true })
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
        const updateInstance = async (instance: InstanceElement, updatedFieldPath: string[],
          updatedValue: string): Promise<InstanceElement> => {
          const after = instance.clone()
          _.set(after.value, updatedFieldPath, updatedValue)
          const deployResult = await adapter.deploy({
            groupID: instance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: instance, after } }],
          })
          if (deployResult.errors.length > 0) {
            if (deployResult.errors.length === 1) throw deployResult.errors[0]
            throw new Error(`Failed updating instance ${instance.elemID.getFullName()} with errors: ${deployResult.errors}`)
          }
          return getChangeElement(deployResult.appliedChanges[0]) as InstanceElement
        }

        const verifyUpdateInstance = async (instance: InstanceElement, updatedFieldPath: string[],
          updatedValue: string, expectedUpdatedValue?: string): Promise<void> => {
          await updateInstance(instance, updatedFieldPath, updatedValue)
          const instanceInfo = await getMetadataFromElement(client, instance)
          expect(instanceInfo).toBeDefined()
          expect(_.get(instanceInfo, updatedFieldPath))
            .toEqual(expectedUpdatedValue ?? updatedValue)
        }

        describe('email folder manipulation', () => {
          let emailFolderInstance: InstanceElement

          beforeAll(async () => {
            emailFolderInstance = await createInstance(client, { name: 'My Email Folder Name',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'MyEmailFolder' },
            'EmailFolder')
            await removeElementIfAlreadyExists(client, emailFolderInstance)
          })

          it('should create email folder instance', async () => {
            await createElementAndVerify(adapter, client, emailFolderInstance)
          })

          it('should update email folder instance', async () => {
            await verifyUpdateInstance(emailFolderInstance, ['name'],
              'My Updated Email Folder Name')
          })

          it('should remove email folder instance', async () => {
            await removeElementAndVerify(adapter, client, emailFolderInstance)
          })
        })

        describe('email template manipulation', () => {
          let emailTemplateInstance: InstanceElement

          beforeAll(async () => {
            emailTemplateInstance = await createInstance(client, {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'TestEmailFolder/MyEmailTemplate',
              name: 'My Email Template Name',
              available: true,
              style: 'none',
              subject: 'My Email Template Subject',
              uiType: 'Aloha',
              encodingKey: 'UTF-8',
              type: 'text',
              description: 'My Email Template Description',
              content: new StaticFile({
                filepath: 'MyEmailTemplate.email',
                content: Buffer.from('My Email Template Body'),
              }),
            }, 'EmailTemplate')
            await removeElementIfAlreadyExists(client, emailTemplateInstance)
          })

          it('should create email template instance', async () => {
            await createElementAndVerify(adapter, client, emailTemplateInstance)
          })

          it('should update email template instance', async () => {
            await verifyUpdateInstance(emailTemplateInstance, ['name'],
              'My Updated Email Template Name')
          })

          it('should remove email template instance', async () => {
            await removeElementAndVerify(adapter, client, emailTemplateInstance)
          })
        })

        describe('report type manipulation', () => {
          let reportTypeInstance: InstanceElement

          beforeAll(async () => {
            reportTypeInstance = await createInstance(client,
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: 'MyReportType',
                label: 'My Report Type Label',
                baseObject: 'Account',
                category: 'accounts',
                deployed: true,
                sections: [{
                  columns: [],
                  masterLabel: 'Master Label',
                }],
              }, 'ReportType')
            await removeElementIfAlreadyExists(client, reportTypeInstance)
          })

          it('should create report type instance', async () => {
            await createElementAndVerify(adapter, client, reportTypeInstance)
          })

          it('should update report type instance', async () => {
            await verifyUpdateInstance(reportTypeInstance, ['label'],
              'My Updated Report Type Label')
          })

          it('should remove report type instance', async () => {
            await removeElementAndVerify(adapter, client, reportTypeInstance)
          })
        })

        describe('report folder manipulation', () => {
          let reportFolderInstance: InstanceElement

          beforeAll(async () => {
            reportFolderInstance = await createInstance(client, {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'MyReportFolder',
              name: 'My Report Folder Name',
            }, 'ReportFolder')
            await removeElementIfAlreadyExists(client, reportFolderInstance)
          })

          it('should create report folder instance', async () => {
            await createElementAndVerify(adapter, client, reportFolderInstance)
          })

          it('should update report folder instance', async () => {
            await verifyUpdateInstance(reportFolderInstance, ['name'],
              'My Updated Report Folder Name')
          })

          it('should remove report folder instance', async () => {
            await removeElementAndVerify(adapter, client, reportFolderInstance)
          })
        })

        describe('report manipulation', () => {
          let reportInstance: InstanceElement

          beforeAll(async () => {
            reportInstance = await createInstance(client, {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'TestReportFolder/MyReport',
              name: 'My Report Name',
              format: 'Summary',
              reportType: 'Opportunity',
            }, 'Report')
            await removeElementIfAlreadyExists(client, reportInstance)
          })

          it('should create report instance', async () => {
            await createElementAndVerify(adapter, client, reportInstance)
          })

          it('should update report instance', async () => {
            await verifyUpdateInstance(reportInstance, ['name'],
              'My Updated Report Name')
          })

          it('should remove report instance', async () => {
            await removeElementAndVerify(adapter, client, reportInstance)
          })
        })

        describe('dashboard folder manipulation', () => {
          let dashboardFolderInstance: InstanceElement

          beforeAll(async () => {
            dashboardFolderInstance = await createInstance(client, { name: 'My Dashboard Folder Name',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'MyDashboardFolder' }, 'DashboardFolder')
            await removeElementIfAlreadyExists(client, dashboardFolderInstance)
          })

          it('should create dashboard folder instance', async () => {
            await createElementAndVerify(adapter, client, dashboardFolderInstance)
          })

          it('should update dashboard folder instance', async () => {
            await verifyUpdateInstance(dashboardFolderInstance, ['name'],
              'My Updated Dashboard Folder Name')
          })

          it('should remove dashboard folder instance', async () => {
            await removeElementAndVerify(adapter, client, dashboardFolderInstance)
          })
        })

        describe('dashboard manipulation', () => {
          let dashboardInstance: InstanceElement

          beforeAll(async () => {
            dashboardInstance = await createInstance(client, {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'TestDashboardFolder/MyDashboard',
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
            }, 'Dashboard')
            await removeElementIfAlreadyExists(client, dashboardInstance)
          })

          it('should create dashboard instance', async () => {
            await createElementAndVerify(adapter, client, dashboardInstance)
          })

          it('should update dashboard instance', async () => {
            await verifyUpdateInstance(dashboardInstance, ['title'],
              'My Updated Dashboard Title')
          })

          it('should remove dashboard instance', async () => {
            await removeElementAndVerify(adapter, client, dashboardInstance)
          })
        })

        describe('AuraDefinitionBundle manipulation', () => {
          let auraInstance: InstanceElement

          beforeAll(async () => {
            auraInstance = await createInstance(
              client,
              { ...auraInstanceValues, [constants.INSTANCE_FULL_NAME_FIELD]: 'MyAuraDefinitionBundle' },
              'AuraDefinitionBundle'
            )
            await removeElementIfAlreadyExists(client, auraInstance)
          })

          it('should create AuraDefinitionBundle instance', async () => {
            await createElementAndVerify(adapter, client, auraInstance)
          })

          it('should update AuraDefinitionBundle instance', async () => {
            const updatedValue = '({ helperMethod : function() {\n // Some Comment\n } })'
            await verifyUpdateInstance(auraInstance, ['helperContent'],
              updatedValue, Buffer.from(updatedValue).toString('base64'))
          })

          it('should remove AuraDefinitionBundle instance', async () => {
            await removeElementAndVerify(adapter, client, auraInstance)
          })
        })

        describe('LightningComponentBundle manipulation', () => {
          let lwcInstance: InstanceElement

          beforeAll(async () => {
            lwcInstance = await createInstance(
              client,
              {
                ...lightningComponentBundleInstanceValues,
                [constants.INSTANCE_FULL_NAME_FIELD]: 'myLightningComponentBundle',
                lwcResources: {
                  lwcResource: [
                    {
                      source: lwcJsResourceContent,
                      filePath: 'lwc/myLightningComponentBundle/myLightningComponentBundle.js',
                    },
                    {
                      source: lwcHtmlResourceContent,
                      filePath: 'lwc/myLightningComponentBundle/myLightningComponentBundle.html',
                    },
                  ],
                },
              },
              findObjectType(result, new ElemID(constants.SALESFORCE, 'LightningComponentBundle')) as ObjectType
            )
            await removeElementIfAlreadyExists(client, lwcInstance)
          })

          it('should create LightningComponentBundle instance', async () => {
            const createdInstance = await createElementAndVerify(adapter, client, lwcInstance)
            // verify the xml attribute fields have no XML_ATTRIBUTE_PREFIX in the NaCL result
            expect(createdInstance.value.targetConfigs.targetConfig[0].targets)
              .toEqual('lightning__RecordPage')
          })

          it('should update LightningComponentBundle instance', async () => {
            const updatedValue = '// UPDATED'
            const updatedInstance = await updateInstance(lwcInstance,
              ['lwcResources', 'lwcResource', '0', 'source'], updatedValue)
            const instanceInfo = await getMetadataFromElement(client, lwcInstance)
            expect(instanceInfo).toBeDefined()
            const lwcResources = _.get(instanceInfo, ['lwcResources', 'lwcResource'])
            const updatedResource = makeArray(lwcResources).find(lwcResource =>
              lwcResource.filePath === 'lwc/myLightningComponentBundle/myLightningComponentBundle.js')
            expect(updatedResource.source).toEqual(Buffer.from(updatedValue).toString('base64'))

            // verify the xml attribute fields have no XML_ATTRIBUTE_PREFIX in the NaCL result
            expect(updatedInstance.value.targetConfigs.targetConfig[0].targets)
              .toEqual('lightning__RecordPage')
          })

          it('should remove LightningComponentBundle instance', async () => {
            await removeElementAndVerify(adapter, client, lwcInstance)
          })
        })

        describe('StaticResource manipulation', () => {
          let staticResourceInstance: InstanceElement

          beforeAll(async () => {
            staticResourceInstance = await createInstance(
              client,
              {
                ...staticResourceInstanceValues,
                [constants.INSTANCE_FULL_NAME_FIELD]: 'MyStaticResource',
              },
              'StaticResource'
            )
            await removeElementIfAlreadyExists(client, staticResourceInstance)
          })

          it('should create static resource instance', async () => {
            await createElementAndVerify(adapter, client, staticResourceInstance)
          })

          it('should update static resource instance', async () => {
            await verifyUpdateInstance(staticResourceInstance, ['description'],
              'My Updated Static Resource Description')
          })

          it('should remove static resource instance', async () => {
            await removeElementAndVerify(adapter, client, staticResourceInstance)
          })
        })
      })
    })

    describe('flow instance manipulations', () => {
      let flow: InstanceElement
      beforeAll(async () => {
        const flowType = findObjectType(result, new ElemID(constants.SALESFORCE, 'Flow')) as ObjectType
        flow = await createInstance(client, {
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
        },
        flowType)

        await removeElementIfAlreadyExists(client, flow)
      })

      it('should create flow', async () => {
        await createElementAndVerify(adapter, client, flow)
      })

      it('should update flow', async () => {
        const newFlow = flow.clone()
        newFlow.value.decisions.rules.conditions.operator = 'NotEqualTo'

        const deployResult = await adapter.deploy({
          groupID: flow.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before: flow, after: newFlow } }],
        })
        flow = getChangeElement(deployResult.appliedChanges[0]) as InstanceElement

        const flowInfo = await getMetadataFromElement(client, flow)
        expect(flowInfo).toBeDefined()
        expect(_.get(flowInfo, 'decisions').rules.conditions.operator).toEqual('NotEqualTo')
      })

      it('should delete flow', async () => {
        await removeElementAndVerify(adapter, client, flow)
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

        await removeElementIfAlreadyExists(client, layout)
      })

      it('should create layout', async () => {
        await createElementAndVerify(adapter, client, layout)
      })

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

        const deployResult = await adapter.deploy({
          groupID: layout.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before: layout, after: newLayout } }],
        })
        layout = getChangeElement(deployResult.appliedChanges[0]) as InstanceElement

        const layoutInfo = await getMetadataFromElement(client, layout)
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

      it('should delete layout', async () => {
        await removeElementAndVerify(adapter, client, layout)
      })

      it('should point parentRole to a Role instance', () => {
        const childRole = findElements(result, 'Role', 'TestChildRole')[0] as InstanceElement
        expect(childRole.value.parentRole).toBeInstanceOf(ReferenceExpression)
        expect(childRole.value.parentRole.elemId.typeName).toEqual('Role')
      })
    })
  })
})
