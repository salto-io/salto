import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Field, Value, Element, Values, BuiltinTypes,
  isInstanceElement, ReferenceExpression, CORE_ANNOTATIONS,
} from 'adapter-api'
import { MetadataInfo, PicklistEntry, RetrieveResult } from 'jsforce'
import { collections } from '@salto/lowerdash'
import * as constants from '../src/constants'
import { STANDARD_VALUE_SET } from '../src/filters/standard_value_sets'
import {
  CustomObject,
  ProfileInfo,
  FieldPermissions,
  ObjectPermissions,
  CustomField,
  FilterItem,
  TopicsForObjectsInfo,
} from '../src/client/types'
import {
  Types, sfCase, fromMetadataInfo, bpCase, metadataType, apiName,
} from '../src/transformers/transformer'
import realAdapter from './adapter'
import { findElements } from '../test/utils'
import SalesforceClient, { API_VERSION } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import { fromRetrieveResult, toMetadataPackageZip } from '../src/transformers/xml_transformer'

const { makeArray } = collections.array
const { FIELD_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE, ADMIN_PROFILE } = constants


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
    missingFields?: string[], label?: string): Promise<boolean> => {
    const readResult = (await client.readMetadata(type, name)
    )[0] as CustomObject
    if (!readResult || !readResult.fullName) {
      return false
    }
    if (label && label !== readResult.label) {
      return false
    }
    if (fields || missingFields) {
      const fieldNames = makeArray(readResult.fields).map(rf => rf.fullName)
      if (fields && !fields.every(f => fieldNames.includes(f))) {
        return false
      }
      return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
    }
    return true
  }

  const fetchedRollupSummaryFieldName = 'rollupsummary__c'

  beforeAll(async () => {
    // enrich the salesforce account with several objects and fields that does not exist by default
    // in order to enrich our fetch test
    const verifyAccountWithRollupSummaryExists = async (): Promise<void> => {
      const accountApiName = 'Account'
      await client.upsert(constants.CUSTOM_FIELD, {
        fullName: `${accountApiName}.${fetchedRollupSummaryFieldName}`,
        label: 'Test Fetch Rollup Summary Field',
        summarizedField: 'Opportunity.Amount',
        summaryFilterItems: {
          field: 'Opportunity.Amount',
          operation: 'greaterThan',
          value: '1',
        },
        summaryForeignKey: 'Opportunity.AccountId',
        summaryOperation: 'sum',
        type: 'Summary',
      } as MetadataInfo)
      await client.update(PROFILE_METADATA_TYPE,
        new ProfileInfo(sfCase(ADMIN_PROFILE), [{
          field: `${accountApiName}.${fetchedRollupSummaryFieldName}`,
          editable: true,
          readable: true,
        }]))
    }

    const verifyEmailFolderExist = async (): Promise<void> => {
      await client.upsert('EmailFolder', {
        fullName: 'TestEmailFolder',
        name: 'Test Email Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)
    }

    const verifyEmailTemplateExists = async (): Promise<void> => {
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

    const verifyReportFolderExist = async (): Promise<void> => {
      await client.upsert('ReportFolder', {
        fullName: 'TestReportFolder',
        name: 'Test Report Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)
    }

    const verifyReportExist = async (): Promise<void> => {
      await client.upsert('Report', {
        fullName: 'TestReportFolder/TestReport',
        format: 'Summary',
        name: 'Test Report Name',
        reportType: 'Opportunity',
      } as MetadataInfo)
    }

    const verifyDashboardFolderExist = async (): Promise<void> => {
      await client.upsert('DashboardFolder', {
        fullName: 'TestDashboardFolder',
        name: 'Test Dashboard Folder Name',
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite',
      } as MetadataInfo)
    }

    const verifyDashboardExist = async (): Promise<void> => {
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

    await Promise.all([
      verifyAccountWithRollupSummaryExists(),
      verifyEmailFolderExist(),
      verifyEmailTemplateExists(),
      verifyReportFolderExist(),
      verifyReportExist(),
      verifyDashboardFolderExist(),
      verifyDashboardExist(),
      verifyCustomObjectInnerTypesExist(),
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
        const lead = findElements(result, 'lead')[0] as ObjectType

        // Test few possible types
        expect(lead.fields.address.type.elemID).toEqual(Types.compoundDataTypes.address.elemID)
        expect(lead.fields.description.type.elemID).toEqual(
          Types.primitiveDataTypes.longtextarea.elemID,
        )
        expect(lead.fields.name.type.elemID).toEqual(Types.compoundDataTypes.name.elemID)
        expect(lead.fields.owner_id.type.elemID).toEqual(Types.primitiveDataTypes.lookup.elemID)

        // Test label
        expect(lead.fields.name.annotations[constants.LABEL]).toBe('Full Name')

        // Test true and false required
        expect(lead.fields.description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(lead.fields.created_date.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)

        // Test picklist restriction.enforce_value prop
        expect(lead.fields.industry
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(false)
        expect(lead.fields.clean_status
          .annotations[constants.FIELD_ANNOTATIONS.RESTRICTED]).toBe(true)

        // Test standard picklist values from a standard value set
        expect(lead.fields.lead_source
          .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET]).toEqual(
          new ReferenceExpression(new ElemID(
            constants.SALESFORCE,
            bpCase(STANDARD_VALUE_SET),
            'instance',
            'lead_source',
          ).createNestedID('standard_value'))
        )

        // Test picklist values
        expect(
          lead.fields.clean_status
            .annotations[constants.FIELD_ANNOTATIONS.VALUE_SET]
            .map((val: Values) => val[constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]).sort()
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
        expect(lead.fields.owner_id.annotations.reference_to).toEqual(['Group', 'User'])

        // Test lookup allow_lookup_record_deletion annotation
        expect(lead.fields.owner_id.annotations.allow_lookup_record_deletion).toBe(true)

        // Test _default
        // TODO: add test to primitive with _default and combobox _default
        //  (no real example for lead)
        expect(lead.fields.status.annotations[CORE_ANNOTATIONS.DEFAULT]).toBe(
          'Open - Not Contacted'
        )

        // Test Rollup Summary
        const account = (findElements(result, 'account') as ObjectType[])
          .filter(a => a.fields[fetchedRollupSummaryFieldName])[0]
        expect(account).toBeDefined()
        const rollupSummary = account.fields[fetchedRollupSummaryFieldName]
        expect(rollupSummary.type.elemID).toEqual(Types.primitiveDataTypes.rollupsummary.elemID)
        expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
          .toEqual('Opportunity.Amount')
        expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
          .toEqual('Opportunity.AccountId')
        expect(rollupSummary.annotations[constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION])
          .toEqual('sum')
        const filterItems = rollupSummary
          .annotations[constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
        expect(filterItems).toHaveLength(1)
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.FIELD]).toEqual('Opportunity.Amount')
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.OPERATION]).toEqual('greaterThan')
        expect(filterItems[0][constants.FILTER_ITEM_FIELDS.VALUE]).toEqual('1')
      })

      describe('should fetch sobject annotations from the custom object instance', () => {
        it('should fetch validation rules', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.validation_rules).toBeDefined()
          expect(lead.annotations.validation_rules).toBeDefined()
          const validationRule = makeArray(lead.annotations.validation_rules)
            .find(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestValidationRule')
          expect(validationRule.active).toBeTruthy()
        })

        it('should fetch business processes', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.business_processes).toBeDefined()
          expect(lead.annotations.business_processes).toBeDefined()
          const businessProcess = makeArray(lead.annotations.business_processes)
            .find(process =>
              process[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestBusinessProcess')
          expect(businessProcess.is_active).toBeTruthy()
        })

        it('should fetch record types', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.record_types).toBeDefined()
          expect(lead.annotations.record_types).toBeDefined()
          const recordType = makeArray(lead.annotations.record_types)
            .find(record => record[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestRecordType')
          expect(recordType.active).toBeTruthy()
          expect(recordType.business_process).toEqual('TestBusinessProcess')
        })

        it('should fetch web links', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.web_links).toBeDefined()
          expect(lead.annotations.web_links).toBeDefined()
          const webLink = makeArray(lead.annotations.web_links)
            .find(link => link[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestWebLink')
          expect(webLink.availability).toEqual('online')
        })

        it('should fetch list views', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.list_views).toBeDefined()
          expect(lead.annotations.list_views).toBeDefined()
          const listView = makeArray(lead.annotations.list_views)
            .find(view => view[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestListView')
          expect(listView.label).toEqual('E2E Fetch ListView')
        })

        it('should fetch field sets', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.field_sets).toBeDefined()
          expect(lead.annotations.field_sets).toBeDefined()
          const fieldSet = makeArray(lead.annotations.field_sets)
            .find(field => field[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestFieldSet')
          expect(fieldSet.label).toEqual('E2E Fetch FieldSet')
        })

        it('should fetch compact layouts', async () => {
          const lead = findElements(result, 'lead')[0] as ObjectType
          expect(lead.annotationTypes.compact_layouts).toBeDefined()
          expect(lead.annotations.compact_layouts).toBeDefined()
          const compactLayouts = makeArray(lead.annotations.compact_layouts)
            .find(layout => layout[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestCompactLayout')
          expect(compactLayouts.label).toEqual('E2E Fetch CompactLayout')
        })
      })
    })

    it('should fetch metadata type', () => {
      const flow = findElements(result, 'flow')[0] as ObjectType
      expect(flow.fields.description.type).toEqual(BuiltinTypes.STRING)
      expect(flow.fields.is_template.type).toEqual(BuiltinTypes.BOOLEAN)
      expect(flow.fields.action_calls.type).toEqual(findElements(result, 'flow_action_call')[0])
      expect(flow.fields.process_type.annotations[constants.FIELD_ANNOTATIONS.RESTRICTED])
        .toEqual(false)
    })

    it('should fetch settings instance', () => {
      // As we fetch now only instances from the STANDALONE list,
      // settings is the only one with instance by default.
      // once we support adding instances test can be improved
      const quoteSettings = findElements(result, 'settings_quote')
        .filter(isInstanceElement)
        .pop() as InstanceElement

      expect(quoteSettings).toBeUndefined()
    })

    it('should retrieve EmailTemplate instance', () => {
      const emailTemplate = findElements(result, 'email_template',
        'test_email_folder_test_email_template')[0] as InstanceElement
      expect(emailTemplate.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestEmailFolder/TestEmailTemplate')
      expect(emailTemplate.value.name).toEqual('Test Email Template Name')
      expect(emailTemplate.value.type).toEqual('text')
    })

    it('should retrieve EmailFolder instance', () => {
      const emailFolder = findElements(result, 'email_folder',
        'test_email_folder')[0] as InstanceElement
      expect(emailFolder.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('TestEmailFolder')
      expect(emailFolder.value.name).toEqual('Test Email Folder Name')
      expect(emailFolder.value.access_type).toEqual('Public')
    })

    it('should retrieve Report instance', () => {
      const report = findElements(result, 'report',
        'test_report_folder_test_report')[0] as InstanceElement
      expect(report.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestReportFolder/TestReport')
      expect(report.value.name).toEqual('Test Report Name')
    })

    it('should retrieve ReportFolder instance', () => {
      const reportFolder = findElements(result, 'report_folder',
        'test_report_folder')[0] as InstanceElement
      expect(reportFolder.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('TestReportFolder')
      expect(reportFolder.value.name).toEqual('Test Report Folder Name')
    })

    it('should retrieve Dashboard instance', () => {
      const dashboard = findElements(result, 'dashboard',
        'test_dashboard_folder_test_dashboard')[0] as InstanceElement
      expect(dashboard.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestDashboardFolder/TestDashboard')
      expect(dashboard.value.title).toEqual('Test Dashboard Title')
    })

    it('should retrieve DashboardFolder instance', () => {
      const dashboardFolder = findElements(result, 'dashboard_folder',
        'test_dashboard_folder')[0] as InstanceElement
      expect(dashboardFolder.value[constants.INSTANCE_FULL_NAME_FIELD])
        .toEqual('TestDashboardFolder')
      expect(dashboardFolder.value.name).toEqual('Test Dashboard Folder Name')
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

    const stringType = Types.primitiveDataTypes.text

    it('should add new profile instance', async () => {
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

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(instance.elemID.name))) {
        await adapter.remove(instance)
      }

      const post = await adapter.add(instance) as InstanceElement

      // Test
      expect(post).toMatchObject(instance)

      expect(
        await objectExists(
          post.type.annotations[constants.METADATA_TYPE], sfCase(post.elemID.name)
        )
      ).toBeTruthy()

      // Clean-up
      await adapter.remove(post)
    })

    it('should add custom object', async () => {
      const customObjectName = 'TestAddCustom__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test')
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
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
      ).toBe('TestAddCustom__c.Description__c')
      expect(
        post.fields.formula.annotations[constants.API_NAME]
      ).toBe('TestAddCustom__c.Formula__c')

      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Description__c', 'Formula__c'])).toBe(true)
      expect((await fieldPermissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)
      expect((await fieldPermissionExists('Standard', [`${customObjectName}.Description__c`]))[0]).toBe(true)
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
              [CORE_ANNOTATIONS.DEFAULT]: '"test"',
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
              [constants.API_NAME]: 'Banana__c',
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
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, ['Banana__c', 'Description__c'],
        ['Address__c'])).toBe(true)
      expect((await fieldPermissionExists('Admin', [`${customObjectName}.Description__c`]))[0]).toBe(true)

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
        description: 'updated e2e profile',
        [constants.INSTANCE_FULL_NAME_FIELD]: instanceElementName,

      })

      if (await objectExists(PROFILE_METADATA_TYPE, sfCase(oldInstance.elemID.name))) {
        await adapter.remove(oldInstance)
      }

      const post = await adapter.add(oldInstance) as InstanceElement
      const updateResult = await adapter.update(oldInstance, newInstance, [])

      // Test
      expect(updateResult).toStrictEqual(newInstance)

      // Checking that the saved instance identical to newInstance
      const savedInstance = (await client.readMetadata(
        PROFILE_METADATA_TYPE, sfCase(newInstance.elemID.name)
      ))[0] as Profile

      type Profile = ProfileInfo & {
        tabVisibilities: Record<string, Value>
        applicationVisibilities: Record<string, Value>
        objectPermissions: Record<string, Value>
        userPermissions: Record<string, Value>
      }

      const valuesMap = new Map<string, Value>()
      const newValues = newInstance.value
      savedInstance.fieldPermissions.forEach(f => valuesMap.set(f.field, f))
      savedInstance.tabVisibilities.forEach((f: Value) => valuesMap.set(f.tab, f))
      savedInstance.applicationVisibilities.forEach((f: Value) => valuesMap.set(f.application, f))
      savedInstance.objectPermissions.forEach((f: Value) => valuesMap.set(f.object, f))
      savedInstance.userPermissions.forEach((f: Value) => valuesMap.set(f.name, f))

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

      // Clean-up
      await adapter.remove(post)
    })

    it("should modify an object's annotations", async () => {
      const customObjectName = 'TestModifyCustomAnnotations__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test modify annotations')
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
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.DEFAULT_VALUE_FORMULA]: 'test2',
          [constants.LABEL]: 'test label 2',
          [constants.API_NAME]: customObjectName,
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
      expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName, undefined, undefined, 'test label 2')).toBe(true)

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
        'Object Updated Label')).toBeTruthy()
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

    it('should add a custom object with various field types', async () => {
      const customObjectName = 'TestAddFields__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add object with various field types')
      const adminReadable = {
        [FIELD_LEVEL_SECURITY_ANNOTATION]: {
          editable: [],
          readable: [ADMIN],
        },
      }
      // we use random suffix for the reference field names since they cannot be created
      // more than once until they are permanently deleted (after 15 days)
      const randomString = String(Date.now()).substring(6)
      const picklistFieldApiName = 'Pickle__c'
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: customObjectName,
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
        fields: {
          pickle: new Field(
            mockElemID,
            'pickle',
            Types.primitiveDataTypes.picklist,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'Picklist description label',
              [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                {
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'NEW',
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: true,
                },
                {
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'OLD',
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: false,
                },
              ],
              ...adminReadable,
            },
          ),
          alpha: new Field(
            mockElemID,
            'alpha',
            Types.primitiveDataTypes.currency,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.DEFAULT_VALUE_FORMULA]: 25,
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
              ...adminReadable,
            },
          ),
          bravo: new Field(
            mockElemID,
            'bravo',
            Types.primitiveDataTypes.autonumber,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
              ...adminReadable,
            },
          ),
          charlie: new Field(
            mockElemID,
            'charlie',
            Types.primitiveDataTypes.date,
            {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
              ...adminReadable,
            },
          ),
          delta: new Field(
            mockElemID,
            'delta',
            Types.primitiveDataTypes.time,
            {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
              ...adminReadable,
            },
          ),
          echo: new Field(
            mockElemID,
            'echo',
            Types.primitiveDataTypes.datetime,
            {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
              ...adminReadable,
            },
          ),
          foxtrot: new Field(
            mockElemID,
            'foxtrot',
            Types.primitiveDataTypes.email,
            {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              ...adminReadable,
            },
          ),
          golf: new Field(
            mockElemID,
            'golf',
            Types.compoundDataTypes.location,
            {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
              ...adminReadable,
            },
          ),
          hotel: new Field(
            mockElemID,
            'hotel',
            Types.primitiveDataTypes.multipicklist,
            {
              [constants.LABEL]: 'Multipicklist description label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                {
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'DO',
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: true,
                },
                {
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'RE',
                  [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: false,
                },
              ],
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
              [constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
                [constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: picklistFieldApiName,
                [constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
                  {
                    [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['NEW', 'OLD'],
                    [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'DO',
                  },
                  {
                    [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['OLD'],
                    [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'RE',
                  },
                ],
              },
              ...adminReadable,
            },
          ),
          india: new Field(
            mockElemID,
            'india',
            Types.primitiveDataTypes.percent,
            {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
              ...adminReadable,
            },
          ),
          juliett: new Field(
            mockElemID,
            'juliett',
            Types.primitiveDataTypes.phone,
            {
              [constants.LABEL]: 'Phone description label',
              ...adminReadable,
            },
          ),
          kilo: new Field(
            mockElemID,
            'kilo',
            Types.primitiveDataTypes.longtextarea,
            {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
              ...adminReadable,
            },
          ),
          lima: new Field(
            mockElemID,
            'lima',
            Types.primitiveDataTypes.richtextarea,
            {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
              ...adminReadable,
            },
          ),
          mike: new Field(
            mockElemID,
            'mike',
            Types.primitiveDataTypes.textarea,
            {
              [constants.LABEL]: 'TextArea description label',
              ...adminReadable,
            },
          ),
          november: new Field(
            mockElemID,
            'november',
            Types.primitiveDataTypes.encryptedtext,
            {
              [constants.LABEL]: 'EncryptedText description label',
              [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
              [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
              [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
              ...adminReadable,
            },
          ),
          oscar: new Field(
            mockElemID,
            'oscar',
            Types.primitiveDataTypes.url,
            {
              [constants.LABEL]: 'Url description label',
              ...adminReadable,
            },
          ),
          papa: new Field(
            mockElemID,
            'papa',
            Types.primitiveDataTypes.number,
            {
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 15,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.DEFAULT_VALUE_FORMULA]: 42,
              [constants.LABEL]: 'Number description label',
              ...adminReadable,
            },
          ),
          queen: new Field(
            mockElemID,
            `queen${randomString}`,
            Types.primitiveDataTypes.lookup,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: false,
              [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
              [constants.LABEL]: 'Lookup description label',
              [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
                [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
                [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1 OR 2',
                [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'This is the Error message',
                [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'This is the Info message',
                [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
                [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
                  [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
                  [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                  [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id',
                },
                {
                  [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.ParentId',
                  [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
                  [constants.FILTER_ITEM_FIELDS.VALUE]: 'ParentIdValue',
                }],
              },
              ...adminReadable,
            }
          ),
          rocket: new Field(
            mockElemID,
            `rocket${randomString}`,
            Types.primitiveDataTypes.masterdetail,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.FIELD_ANNOTATIONS.REFERENCE_TO]: ['Case'],
              [constants.LABEL]: 'MasterDetail description label',
              [constants.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: true,
              [constants.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: true,
            }
          ),
        },
      })
      const rollupSummaryFieldName = 'susu'
      const rollupSummaryFieldApiName = `${rollupSummaryFieldName}__c`

      const findCustomCase = (): ObjectType => {
        const caseObjects = findElements(result, 'case') as ObjectType[]
        const customCase = caseObjects
          .filter(c => _.isUndefined(c.annotations[constants.API_NAME]))[0]
        const caseObject = customCase ?? caseObjects[0]
        // we add API_NAME annotation so the adapter will be able to construct the fields full name
        // upon update. in a real scenario, the case object is merged in the core and passed
        // to the adapter with the API_NAME annotation
        caseObject.annotations[constants.API_NAME] = 'Case'
        return caseObject
      }

      const normalizeReferences = (obj: ObjectType): void => {
        const relFields = Object.values(obj.fields)
          .filter(f => f.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
        relFields.forEach(field => {
          Object.entries(field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]).forEach(keyValue => {
            // Change all reference expressions to the name without the full_name at the end.
            const fullNames = (keyValue[1] as ReferenceExpression[]).map(ref =>
              sfCase(ref.traversalParts[3]))
            field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION][keyValue[0]] = fullNames
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
      if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
        await adapter.remove(element)
      }
      const post = await adapter.add(element)

      // Test
      const objectFields = await client.describeSObjects([customObjectName])
      expect(objectFields[0]).toBeDefined()
      const allFields = objectFields[0].fields
      // Verify picklist
      const picklistField = allFields.filter(field => field.name === picklistFieldApiName)[0]
      expect(picklistField).toBeDefined()
      expect(picklistField.label).toBe('Picklist description label')
      expect(picklistField.type).toBe('picklist')
      expect(picklistField.dependentPicklist).toBeFalsy()
      expect(picklistField.restrictedPicklist).toBeTruthy()
      expect(_.isEqual((picklistField.picklistValues as PicklistEntry[]).map(value => value.label), ['NEW', 'OLD'])).toBeTruthy()
      const picklistValueNew = (picklistField.picklistValues as PicklistEntry[]).filter(value => value.label === 'NEW')[0]
      expect(picklistValueNew).toBeDefined()
      expect(picklistValueNew.defaultValue).toEqual(true)
      const picklistValueOld = (picklistField.picklistValues as PicklistEntry[]).filter(value => value.label === 'OLD')[0]
      expect(picklistValueOld).toBeDefined()
      expect(picklistValueOld.defaultValue).toEqual(false)

      // Verify currency
      const currencyFieldApiName = 'Alpha__c'
      const currencyField = allFields.filter(field => field.name === currencyFieldApiName)[0]
      expect(currencyField).toBeDefined()
      expect(currencyField.label).toBe('Currency description label')
      expect(currencyField.scale).toBe(3)
      expect(currencyField.precision).toBe(18)
      expect(currencyField.type).toBe('currency')
      // Verify autonumber
      const autonumber = allFields.filter(field => field.name === 'Bravo__c')[0]
      expect(autonumber).toBeDefined()
      expect(autonumber.label).toBe('Autonumber description label')
      expect(autonumber.type).toBe('string')
      // TODO: As of this point we do not know how to retrieve the displayFormat annotation from
      // the autonumber field

      // Verify date
      const date = allFields.filter(field => field.name === 'Charlie__c')[0]
      expect(date).toBeDefined()
      expect(date.label).toBe('Date description label')
      expect(date.type).toBe('date')
      // Verify time
      const time = allFields.filter(field => field.name === 'Delta__c')[0]
      expect(time).toBeDefined()
      expect(time.label).toBe('Time description label')
      expect(time.type).toBe('time')
      // Verify datetime
      const datetime = allFields.filter(field => field.name === 'Echo__c')[0]
      expect(datetime).toBeDefined()
      expect(datetime.label).toBe('DateTime description label')
      expect(datetime.type).toBe('datetime')
      // Verify email
      const email = allFields.filter(field => field.name === 'Foxtrot__c')[0]
      expect(email).toBeDefined()
      expect(email.label).toBe('Email description label')
      expect(email.type).toBe('email')
      expect(email.unique).toBe(true)
      expect(email.caseSensitive).toBe(true)
      // Verify location
      const location = allFields.filter(field => field.name === 'Golf__c')[0]
      expect(location).toBeDefined()
      expect(location.label).toBe('Location description label')
      expect(location.type).toBe('location')
      expect(location.displayLocationInDecimal).toBe(true)
      // TODO: From some reason the api returns scale = 0 despite the fact that it successfully
      // sets the scale to what was defined (verified in Salesforce UX)
      // expect(location.scale).toBe(2)

      // Verify multipicklist
      const multipicklist = allFields.filter(field => field.name === 'Hotel__c')[0]
      expect(multipicklist).toBeDefined()
      expect(multipicklist.label).toBe('Multipicklist description label')
      expect(multipicklist.type).toBe('multipicklist')
      expect(multipicklist.precision).toBe(4)
      expect(multipicklist.dependentPicklist).toBeTruthy()
      expect(_.isEqual((multipicklist.picklistValues as PicklistEntry[]).map(value => value.label), ['DO', 'RE'])).toBeTruthy()
      const multipicklistValueDo = (multipicklist.picklistValues as PicklistEntry[]).filter(value => value.label === 'DO')[0]
      expect(multipicklistValueDo).toBeDefined()
      expect(multipicklistValueDo.defaultValue).toEqual(true)
      const multipicklistValueRe = (multipicklist.picklistValues as PicklistEntry[]).filter(value => value.label === 'RE')[0]
      expect(multipicklistValueRe).toBeDefined()
      expect(multipicklistValueRe.defaultValue).toEqual(false)
      // Verify percent
      const percentField = allFields.filter(field => field.name === 'India__c')[0]
      expect(percentField).toBeDefined()
      expect(percentField.label).toBe('Percent description label')
      expect(percentField.type).toBe('percent')
      expect(percentField.scale).toBe(3)
      expect(percentField.precision).toBe(12)
      // Verify phone
      const phoneField = allFields.filter(field => field.name === 'Juliett__c')[0]
      expect(phoneField).toBeDefined()
      expect(phoneField.label).toBe('Phone description label')
      expect(phoneField.type).toBe('phone')
      // Verify longtextarea
      // TODO: We do not know how to retrieve the visible lines info when fetching
      // long text area
      const longTextAreaField = allFields.filter(field => field.name === 'Kilo__c')[0]
      expect(longTextAreaField).toBeDefined()
      expect(longTextAreaField.label).toBe('LongTextArea description label')
      expect(longTextAreaField.type).toBe('textarea')
      expect(longTextAreaField.length).toBe(32768)
      // Verify richtextarea
      // TODO: We do not know how to retrieve the visible lines info when fetching
      // rich text area
      const richTextAreaField = allFields.filter(field => field.name === 'Lima__c')[0]
      expect(richTextAreaField).toBeDefined()
      expect(richTextAreaField.label).toBe('RichTextArea description label')
      expect(richTextAreaField.type).toBe('textarea')
      expect(richTextAreaField.length).toBe(32768)
      // Verify textarea
      const textAreaField = allFields.filter(field => field.name === 'Mike__c')[0]
      expect(textAreaField).toBeDefined()
      expect(textAreaField.label).toBe('TextArea description label')
      expect(textAreaField.type).toBe('textarea')
      // Verify Encrypted Text
      const encryptedTextField = allFields.filter(field => field.name === 'November__c')[0]
      expect(encryptedTextField).toBeDefined()
      expect(encryptedTextField.label).toBe('EncryptedText description label')
      expect(encryptedTextField.type).toBe('encryptedstring')
      expect(encryptedTextField.mask).toBe('X')
      expect(encryptedTextField.maskType).toBe('creditCard')
      expect(encryptedTextField.length).toBe(35)
      // Verify textarea
      const urlField = allFields.filter(field => field.name === 'Oscar__c')[0]
      expect(urlField).toBeDefined()
      expect(urlField.label).toBe('Url description label')
      expect(urlField.type).toBe('url')
      // Verify number
      const numberField = allFields.filter(field => field.name === 'Papa__c')[0]
      expect(numberField).toBeDefined()
      expect(numberField.label).toBe('Number description label')
      expect(numberField.type).toBe('double')
      expect(numberField.defaultValueFormula).toBe('42')
      expect(numberField.scale).toBe(3)
      expect(numberField.precision).toBe(15)
      expect(numberField.unique).toBe(true)
      // Verify lookup
      const lookupField = allFields.filter(field => field.name === `Queen${randomString}__c`)[0]
      expect(lookupField).toBeDefined()
      expect(lookupField.label).toBe('Lookup description label')
      expect(lookupField.type).toBe('reference')
      expect(lookupField.relationshipName).toBe(`Queen${randomString}__r`)
      expect(lookupField.referenceTo).toEqual(['Case'])
      expect(_.get(lookupField, 'restrictedDelete')).toBe(true)
      expect(lookupField.filteredLookupInfo).toBeDefined()
      // Verify masterdetail
      const masterDetailApiName = `Rocket${randomString}__c`
      const masterDetailField = allFields.filter(field => field.name === masterDetailApiName)[0]
      expect(masterDetailField).toBeDefined()
      expect(masterDetailField.label).toBe('MasterDetail description label')
      expect(masterDetailField.type).toBe('reference')
      expect(masterDetailField.relationshipName).toBe(`Rocket${randomString}__r`)
      expect(masterDetailField.referenceTo).toEqual(['Case'])
      expect(masterDetailField.cascadeDelete).toBe(true)
      expect(masterDetailField.writeRequiresMasterRead).toBe(true)
      expect(masterDetailField.updateable).toBe(true)

      const verifyRollupSummaryFieldAddition = async (): Promise<void> => {
        const addRollupSummaryField = async (): Promise<ObjectType> => {
          const caseAfterFieldAddition = origCase.clone()
          caseAfterFieldAddition.fields[rollupSummaryFieldName] = new Field(
            caseAfterFieldAddition.elemID,
            rollupSummaryFieldName,
            Types.primitiveDataTypes.rollupsummary,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'Rollup Summary description label',
              [constants.API_NAME]: apiNameAnno('Case', rollupSummaryFieldApiName),
              [constants.FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: `${customObjectName}.${currencyFieldApiName}`,
              [constants.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: `${customObjectName}.${masterDetailApiName}`,
              [constants.FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'max',
              [constants.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [
                {
                  [constants.FILTER_ITEM_FIELDS.FIELD]: `${customObjectName}.${currencyFieldApiName}`,
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
            .toEqual(`${customObjectName}.${currencyFieldApiName}`)
          expect(_.get(fetchedRollupSummary, 'summaryForeignKey'))
            .toEqual(`${customObjectName}.${masterDetailApiName}`)
          expect(_.get(fetchedRollupSummary, 'summaryOperation')).toEqual('max')
          expect(fetchedRollupSummary.summaryFilterItems).toBeDefined()
          const filterItems = fetchedRollupSummary.summaryFilterItems as FilterItem
          expect(filterItems.field).toEqual(`${customObjectName}.${currencyFieldApiName}`)
          expect(filterItems.operation).toEqual('greaterThan')
          expect(filterItems.value).toEqual('1')
        }

        const caseAfterFieldAddition = await addRollupSummaryField()
        await verifyRollupSummaryField()
        await removeRollupSummaryFieldFromCase(caseAfterFieldAddition, rollupSummaryFieldName)
      }

      await verifyRollupSummaryFieldAddition()
      // Clean-up
      await adapter.remove(post as ObjectType)
    })

    it('should add lookupFilter to an existing lookup field', async () => {
      const customObjectName = 'TestAddLookupFilter__c'
      const mockElemID = new ElemID(constants.SALESFORCE, 'test add lookupFilter')
      const randomString = String(Date.now()).substring(6)
      const lookupFieldName = `lookup${randomString}`
      const lookupFieldApiName = `${_.camelCase(lookupFieldName)}__c`
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

      oldElement.fields[lookupFieldName] = new Field(
        mockElemID,
        lookupFieldName,
        Types.primitiveDataTypes.lookup,
        {
          [constants.API_NAME]: lookupFieldApiFullName,
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

      newElement.fields[lookupFieldName] = new Field(
        mockElemID,
        lookupFieldName,
        Types.primitiveDataTypes.lookup,
        {
          [constants.API_NAME]: lookupFieldApiFullName,
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
          data: { before: oldElement.fields[lookupFieldName],
            after: newElement.fields[lookupFieldName] } }])
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
      const getRulesFromClient = async (): Promise<Values> => fromMetadataInfo(
        (await client.readMetadata('AssignmentRules', 'Lead'))[0]
      )

      const dummyAssignmentRulesType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'assignment_rules'),
        annotations: {
          [constants.METADATA_TYPE]: 'AssignmentRules',
        },
      })

      let before: InstanceElement
      let after: InstanceElement
      let validAssignment: Values

      beforeAll(async () => {
        // Make sure our test rule does not exist before we start
        await client.delete('AssignmentRule', 'Lead.NonStandard').catch(() => undefined)

        before = new InstanceElement(
          'lead_assignment_rules',
          dummyAssignmentRulesType,
          await getRulesFromClient(),
        )
        validAssignment = _.omit(
          _.flatten([_.flatten([before.value.assignment_rule])[0].rule_entry]).pop(),
          'criteria_items'
        )
      })

      beforeEach(async () => {
        after = new InstanceElement(
          before.elemID.name,
          before.type,
          _.cloneDeep(before.value),
        )
      })

      afterEach(async () => {
        await adapter.update(after, before, [])
      })

      it('should create rule', async () => {
        // eslint-disable-next-line @typescript-eslint/camelcase
        after.value.assignment_rule = _.flatten([
          after.value.assignment_rule,
          {
            [constants.INSTANCE_FULL_NAME_FIELD]: 'NonStandard',
            active: 'false',
            // eslint-disable-next-line @typescript-eslint/camelcase
            rule_entry: _.merge({}, validAssignment, {
              // eslint-disable-next-line @typescript-eslint/camelcase
              criteria_items: {
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
        expect(new Set(updatedRules.assignment_rule)).toEqual(new Set(after.value.assignment_rule))

        // Because removing assignment rules does not work currently, we have to clean up with a
        // different api call, this part of the test should be changed once removing rules works
        // we should be issuing another `sfAdater.update` call here in order to remove the rule
        await client.delete('AssignmentRule', 'Lead.NonStandard')

        // TODO: test deletion of assignment rule once it is fixed
      })

      it('should update existing', async () => {
        // eslint-disable-next-line @typescript-eslint/camelcase
        const rule = _.flatten([after.value.assignment_rule])[0]
        // eslint-disable-next-line @typescript-eslint/camelcase
        rule.rule_entry = _.flatten([rule.rule_entry])
        rule.rule_entry.push(_.merge({}, validAssignment, {
          // eslint-disable-next-line @typescript-eslint/camelcase
          assigned_to: validAssignment.assigned_to,
          // eslint-disable-next-line @typescript-eslint/camelcase
          assigned_to_type: validAssignment.assigned_to_type,
          // eslint-disable-next-line @typescript-eslint/camelcase
          criteria_items: [
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
        _.flatten([rule.rule_entry[0].criteria_items])[0].value = 'bla'

        await adapter.update(before, after, [])

        const updatedRules = await getRulesFromClient()
        expect(updatedRules).toEqual(after.value)
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
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_version: API_VERSION,
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
            '<apex:page >Created by e2e test!</apex:page>')
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
              // eslint-disable-next-line @typescript-eslint/camelcase
              base_object: 'Account',
              category: 'accounts',
              deployed: true,
              sections: [{
                columns: [],
                // eslint-disable-next-line @typescript-eslint/camelcase
                master_label: 'Master Label',
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
              // eslint-disable-next-line @typescript-eslint/camelcase
              report_type: 'Opportunity',
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
              // eslint-disable-next-line @typescript-eslint/camelcase
              background_end_color: '#FFFFFF',
              // eslint-disable-next-line @typescript-eslint/camelcase
              background_fade_direction: 'Diagonal',
              // eslint-disable-next-line @typescript-eslint/camelcase
              background_start_color: '#FFFFFF',
              // eslint-disable-next-line @typescript-eslint/camelcase
              text_color: '#000000',
              title: 'My Dashboard Title',
              // eslint-disable-next-line @typescript-eslint/camelcase
              title_color: '#000000',
              // eslint-disable-next-line @typescript-eslint/camelcase
              title_size: '12',
              // eslint-disable-next-line @typescript-eslint/camelcase
              left_section: {
                // eslint-disable-next-line @typescript-eslint/camelcase
                column_size: 'Medium',
                components: [],
              },
              // eslint-disable-next-line @typescript-eslint/camelcase
              right_section: {
                // eslint-disable-next-line @typescript-eslint/camelcase
                column_size: 'Medium',
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

    describe('custom object inner types manipulations', () => {
      const findInstance = async (type: string, fullName: string):
        Promise<MetadataInfo | undefined> => {
        const instanceInfo = (await client.readMetadata(type, fullName))[0]
        if (instanceInfo && instanceInfo.fullName) {
          return instanceInfo
        }
        return undefined
      }

      const removeIfAlreadyExists = async (type: string, fullName: string, annotationName: string):
        Promise<void> => {
        if (await objectExists(type, fullName)) {
          await client.delete(type, fullName)
          const lead = findElements(result, 'lead')[0] as ObjectType
          lead.annotations[annotationName] = makeArray(lead.annotations[annotationName])
            .filter(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] !== fullName)
        }
      }

      describe('validation rules manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('ValidationRule', 'Lead.MyValidationRule', 'validation_rule')
        })

        describe('create validation rule', () => {
          it('should create validation rule', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.validation_rules = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyValidationRule',
              active: true,
              description: 'My Validation Rule',
              // eslint-disable-next-line @typescript-eslint/camelcase
              error_condition_formula: '$User.IsActive  = true',
              // eslint-disable-next-line @typescript-eslint/camelcase
              error_message: 'Error Message!',
            }, ...makeArray(newLead.annotations.validation_rules)]

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('ValidationRule', 'Lead.MyValidationRule')).toBeTruthy()
            // to save another fetch, we set the new validation rule on the old object
            // eslint-disable-next-line @typescript-eslint/camelcase
            oldLead.annotations.validation_rules = newLead.annotations.validation_rules
          })
        })

        describe('update validation rule', () => {
          it('should update validation rule', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const validationRuleToUpdate = makeArray(newLead.annotations.validation_rules)
              .find(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyValidationRule')
            expect(validationRuleToUpdate).toBeDefined()
            validationRuleToUpdate.description = 'My Updated Validation Rule'

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const validationRuleInfo = await findInstance('ValidationRule', 'Lead.MyValidationRule')
            expect(validationRuleInfo).toBeDefined()
            expect(_.get(validationRuleInfo, 'description')).toEqual('My Updated Validation Rule')
          })
        })

        describe('delete validation rule', () => {
          it('should delete validation rule', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.validation_rules = makeArray(newLead.annotations.validation_rules)
              .filter(rule => rule[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyValidationRule')

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('ValidationRule', 'Lead.MyValidationRule')).toBeFalsy()
          })
        })
      })

      describe('web links manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('WebLink', 'Lead.MyWebLink', 'web_links')
        })

        describe('create web link', () => {
          it('should create web link', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.web_links = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyWebLink',
              availability: 'online',
              description: 'My Web Link',
              // eslint-disable-next-line @typescript-eslint/camelcase
              display_type: 'button',
              // eslint-disable-next-line @typescript-eslint/camelcase
              encoding_key: 'UTF-8',
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_menubar: false,
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_scrollbars: true,
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_toolbar: false,
              height: 600,
              // eslint-disable-next-line @typescript-eslint/camelcase
              is_resizable: true,
              // eslint-disable-next-line @typescript-eslint/camelcase
              link_type: 'url',
              // eslint-disable-next-line @typescript-eslint/camelcase
              master_label: 'E2E Fetch WebLink',
              // eslint-disable-next-line @typescript-eslint/camelcase
              open_type: 'newWindow',
              position: 'none',
              protected: false,
              url: '{!Lead.CreatedBy} = "MyName"',
            }, ...makeArray(newLead.annotations.web_links)]

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('WebLink', 'Lead.MyWebLink')).toBeTruthy()
            // to save another fetch, we set the new web link on the old object
            // eslint-disable-next-line @typescript-eslint/camelcase
            oldLead.annotations.web_links = newLead.annotations.web_links
          })
        })

        describe('update web link', () => {
          it('should update web link', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const webLinkToUpdate = makeArray(newLead.annotations.web_links)
              .find(link => link[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyWebLink')
            expect(webLinkToUpdate).toBeDefined()
            webLinkToUpdate.description = 'My Updated Web Link'

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const webLinkInfo = await findInstance('WebLink', 'Lead.MyWebLink')
            expect(webLinkInfo).toBeDefined()
            expect(_.get(webLinkInfo, 'description')).toEqual('My Updated Web Link')
          })
        })

        describe('delete web link', () => {
          it('should delete web link', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.web_links = makeArray(newLead.annotations.web_links)
              .filter(link => link[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyWebLink')

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('WebLink', 'Lead.MyWebLink')).toBeFalsy()
          })
        })
      })

      describe('list views manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('ListView', 'Lead.MyListView', 'list_views')
        })

        describe('create list view', () => {
          it('should create list view', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.list_views = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyListView',
              label: 'My List View',
              // eslint-disable-next-line @typescript-eslint/camelcase
              filter_scope: 'Everything',
              filters: {
                field: 'LEAD.STATUS',
                operation: 'equals',
                value: 'closed',
              },
            }, ...makeArray(newLead.annotations.list_views)]

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('ListView', 'Lead.MyListView')).toBeTruthy()
            // to save another fetch, we set the new list view on the old object
            // eslint-disable-next-line @typescript-eslint/camelcase
            oldLead.annotations.list_views = newLead.annotations.list_views
          })
        })

        describe('update list view', () => {
          it('should update list view', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const listViewToUpdate = makeArray(newLead.annotations.list_views)
              .find(view => view[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyListView')
            expect(listViewToUpdate).toBeDefined()
            listViewToUpdate.label = 'My Updated List View'

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const listViewInfo = await findInstance('ListView', 'Lead.MyListView')
            expect(listViewInfo).toBeDefined()
            expect(_.get(listViewInfo, 'label')).toEqual('My Updated List View')
          })
        })

        describe('delete list view', () => {
          it('should delete list view', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.list_views = makeArray(newLead.annotations.list_views)
              .filter(view => view[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyListView')

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('ListView', 'Lead.MyListView')).toBeFalsy()
          })
        })
      })

      describe('compact layouts manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('CompactLayout', 'Lead.MyCompactLayout', 'compact_layouts')
        })

        describe('create compact layout', () => {
          it('should create compact layout', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.compact_layouts = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyCompactLayout',
              label: 'My Compact Layout',
              fields: [
                'Address',
                'Company',
              ],
            }, ...makeArray(newLead.annotations.compact_layouts)]

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('CompactLayout', 'Lead.MyCompactLayout')).toBeTruthy()
            // to save another fetch, we set the new compact layout on the old object
            // eslint-disable-next-line @typescript-eslint/camelcase
            oldLead.annotations.compact_layouts = newLead.annotations.compact_layouts
          })
        })

        describe('update compact layout', () => {
          it('should update compact layout', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const compactLayoutToUpdate = makeArray(newLead.annotations.compact_layouts)
              .find(layout => layout[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyCompactLayout')
            expect(compactLayoutToUpdate).toBeDefined()
            compactLayoutToUpdate.label = 'My Updated Compact Layout'

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const compactLayoutInfo = await findInstance('CompactLayout', 'Lead.MyCompactLayout')
            expect(compactLayoutInfo).toBeDefined()
            expect(_.get(compactLayoutInfo, 'label')).toEqual('My Updated Compact Layout')
          })
        })

        describe('delete compact layout', () => {
          it('should delete compact layout', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.compact_layouts = makeArray(newLead.annotations.compact_layouts)
              .filter(layout => layout[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyCompactLayout')

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('CompactLayout', 'Lead.MyCompactLayout')).toBeFalsy()
          })
        })
      })

      describe('field sets manipulations', () => {
        beforeAll(async () => {
          await removeIfAlreadyExists('FieldSet', 'Lead.MyFieldSet', 'field_sets')
        })

        describe('create field set', () => {
          it('should create field set', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.field_sets = [{
              [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead.MyFieldSet',
              description: 'My Field Set',
              // eslint-disable-next-line @typescript-eslint/camelcase
              displayed_fields: [
                {
                  field: 'State',
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  is_field_managed: false,
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  is_required: false,
                },
                {
                  field: 'Status',
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  is_field_managed: false,
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  is_required: false,
                },
              ],
              label: 'My Field Set',
            }, ...makeArray(newLead.annotations.field_sets)]

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('FieldSet', 'Lead.MyFieldSet')).toBeTruthy()
            // to save another fetch, we set the new field sets on the old object
            // eslint-disable-next-line @typescript-eslint/camelcase
            oldLead.annotations.field_sets = newLead.annotations.field_sets
          })
        })

        describe('update field set', () => {
          it('should update field set', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const fieldSetToUpdate = makeArray(newLead.annotations.field_sets)
              .find(fieldSet => fieldSet[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.MyFieldSet')
            expect(fieldSetToUpdate).toBeDefined()
            fieldSetToUpdate.description = 'My Updated Field Set'

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const fieldSetInfo = await findInstance('FieldSet', 'Lead.MyFieldSet')
            expect(fieldSetInfo).toBeDefined()
            expect(_.get(fieldSetInfo, 'description')).toEqual('My Updated Field Set')
          })
        })

        describe('delete field set', () => {
          it('should delete field set', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            newLead.annotations.field_sets = makeArray(newLead.annotations.field_sets)
              .filter(fieldSet => fieldSet[constants.INSTANCE_FULL_NAME_FIELD] !== 'Lead.MyFieldSet')

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            expect(await objectExists('FieldSet', 'Lead.MyFieldSet')).toBeFalsy()
          })
        })
      })

      describe('business processes manipulations', () => {
        // BusinessProcess deletion is not supported through API.
        // Thus, we only update the existing BusinessProcess and not create new one.
        describe('update business process', () => {
          it('should update business process', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const businessProcessToUpdate = makeArray(newLead.annotations.business_processes)
              .find(process =>
                process[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestBusinessProcess')
            expect(businessProcessToUpdate).toBeDefined()
            const randomString = String(Date.now()).substring(6)
            businessProcessToUpdate.description = `BusinessProcess that should be fetched in e2e test updated ${randomString}`

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const businessProcessInfo = await findInstance('BusinessProcess',
              'Lead.TestBusinessProcess')
            expect(businessProcessInfo).toBeDefined()
            expect(_.get(businessProcessInfo, 'description'))
              .toEqual(`BusinessProcess that should be fetched in e2e test updated ${randomString}`)
          })
        })
      })

      describe('record types manipulations', () => {
        // RecordType deletion is not supported through API.
        // Thus, we only update the existing RecordType and not create new one.
        describe('update record type', () => {
          it('should update record type', async () => {
            const oldLead = findElements(result, 'lead')[0] as ObjectType
            const newLead = oldLead.clone()
            // eslint-disable-next-line @typescript-eslint/camelcase
            const recordTypeToUpdate = makeArray(newLead.annotations.record_types)
              .find(record => record[constants.INSTANCE_FULL_NAME_FIELD] === 'Lead.TestRecordType')
            expect(recordTypeToUpdate).toBeDefined()
            const randomString = String(Date.now()).substring(6)
            recordTypeToUpdate.description = `RecordType that should be fetched in e2e test updated ${randomString}`

            await adapter.update(oldLead, newLead,
              [{ action: 'modify', data: { before: oldLead, after: newLead } }])

            const validationRuleInfo = await findInstance('RecordType', 'Lead.TestRecordType')
            expect(validationRuleInfo).toBeDefined()
            expect(_.get(validationRuleInfo, 'description'))
              .toEqual(`RecordType that should be fetched in e2e test updated ${randomString}`)
          })
        })
      })

      it('should create an object with inner types', async () => {
        const customObjectName = 'TestAddObjectWithInnerTypes__c'
        const elemID = new ElemID(constants.SALESFORCE, 'test_object')
        const objectWithInnerTypes = new ObjectType({
          elemID,
          annotations: {
            [constants.API_NAME]: customObjectName,
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            // eslint-disable-next-line @typescript-eslint/camelcase
            web_links: {
              [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(customObjectName, 'WebLink'),
              availability: 'online',
              description: 'My Web Link',
              // eslint-disable-next-line @typescript-eslint/camelcase
              display_type: 'button',
              // eslint-disable-next-line @typescript-eslint/camelcase
              encoding_key: 'UTF-8',
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_menubar: false,
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_scrollbars: true,
              // eslint-disable-next-line @typescript-eslint/camelcase
              has_toolbar: false,
              height: 600,
              // eslint-disable-next-line @typescript-eslint/camelcase
              is_resizable: true,
              // eslint-disable-next-line @typescript-eslint/camelcase
              link_type: 'url',
              // eslint-disable-next-line @typescript-eslint/camelcase
              master_label: 'E2E Fetch WebLink',
              // eslint-disable-next-line @typescript-eslint/camelcase
              open_type: 'newWindow',
              position: 'none',
              protected: false,
              url: `!${customObjectName}.CreatedBy} = "MyName"`,
            },
            // eslint-disable-next-line @typescript-eslint/camelcase
            field_sets: [
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(customObjectName, 'FieldSet1'),
                description: 'My Field Set 1',
                // eslint-disable-next-line @typescript-eslint/camelcase
                displayed_fields: [
                  {
                    field: 'description__c',
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    is_field_managed: false,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    is_required: false,
                  },
                ],
                label: 'My Field Set 1',
              },
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: apiNameAnno(customObjectName, 'FieldSet2'),
                description: 'My Field Set 2',
                // eslint-disable-next-line @typescript-eslint/camelcase
                displayed_fields: [
                  {
                    field: 'description__c',
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    is_field_managed: false,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    is_required: false,
                  },
                ],
                label: 'My Field Set 2',
              }],
          },
          fields: {
            description: new Field(
              elemID,
              'description',
              stringType,
              {
                [CORE_ANNOTATIONS.REQUIRED]: false,
                [constants.LABEL]: 'description label',
              },
            ),
          },
        })
        if (await objectExists(constants.CUSTOM_OBJECT, customObjectName)) {
          await adapter.remove(objectWithInnerTypes)
        }
        const created = await adapter.add(objectWithInnerTypes)
        expect(await objectExists(constants.CUSTOM_OBJECT, customObjectName)).toBeTruthy()
        expect(created.annotations.web_links.full_name).toEqual(apiNameAnno(customObjectName, 'WebLink'))
        expect(await objectExists('WebLink', apiNameAnno(customObjectName, 'WebLink'))).toBeTruthy()
        expect(await objectExists('FieldSet', apiNameAnno(customObjectName, 'FieldSet1')))
          .toBeTruthy()
        expect(await objectExists('FieldSet', apiNameAnno(customObjectName, 'FieldSet2')))
          .toBeTruthy()
        await adapter.remove(objectWithInnerTypes)
      })
    })
  })
})
