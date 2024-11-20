/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  Element,
  FetchResult,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  Values,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { DEFAULT_CONFIG } from '../src/config'
import fetchMockReplies from './fetch_mock_replies.json'
import { credentialsType, MicrosoftServicesToManage } from '../src/auth'

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

describe('Microsoft Security adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/v1.0/me').reply(200, { app: { id_code: '123' } })
    mockAxiosAdapter.onPost('https://login.microsoftonline.com/testTenantId/oauth2/v2.0/token').reply(200, {
      access_token: 'testAccessToken',
    })
    ;([...fetchMockReplies] as MockReply[]).forEach(({ url, params, response }) => {
      const mock = mockAxiosAdapter.onGet.bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    const setup = async (servicesToManage: MicrosoftServicesToManage): Promise<FetchResult> =>
      adapter
        .operations({
          credentials: new InstanceElement('config', credentialsType, {
            tenantId: 'testTenantId',
            clientId: 'testClientId',
            clientSecret: 'testClient',
            refreshToken: 'testRefreshToken',
            servicesToManage,
          }),
          config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
          elementsSource: buildElementsSourceFromElements([]),
        })
        .fetch({ progressReporter: { reportProgress: () => null } })

    describe('full', () => {
      let elements: Element[]
      beforeEach(async () => {
        ;({ elements } = await setup({ Entra: true, Intune: true }))
      })

      it('should generate the right elements on fetch', async () => {
        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'EntraAdministrativeUnit',
          'EntraAppRole',
          'EntraApplication',
          'EntraAuthenticationMethodPolicy',
          'EntraAuthenticationMethodPolicy__authenticationMethodConfigurations',
          'EntraAuthenticationStrengthPolicy',
          'EntraConditionalAccessPolicy',
          'EntraConditionalAccessPolicyNamedLocation',
          'EntraCrossTenantAccessPolicy',
          'EntraCustomSecurityAttributeDefinition',
          'EntraCustomSecurityAttributeDefinition__allowedValues',
          'EntraCustomSecurityAttributeSet',
          'EntraDirectoryRoleTemplate',
          'EntraDomain',
          'EntraGroup',
          'EntraGroupLifeCyclePolicy',
          'EntraGroup__appRoleAssignments',
          'EntraOauth2PermissionGrant',
          'EntraPermissionGrantPolicy',
          'EntraRoleDefinition',
          'EntraServicePrincipal',
          'IntuneApplication',
          'IntuneApplicationConfigurationManagedApp',
          'IntuneApplicationConfigurationManagedDevice',
          'IntuneApplicationProtectionAndroid',
          'IntuneApplicationProtectionIOS',
          'IntuneApplicationProtectionWindows',
          'IntuneApplicationProtectionWindowsInformationProtection',
          'IntuneDeviceCompliance',
          'IntuneDeviceConfiguration',
          'IntuneDeviceConfigurationSettingCatalog',
          'IntuneFilter',
          'IntunePlatformScriptLinux',
          'IntunePlatformScriptMacOS',
          'IntunePlatformScriptWindows',
          'IntuneScopeTag',
        ])
        // TODO: Validate Entra sub-types and structure of the elements
      })

      describe('specific instances', () => {
        describe('Intune', () => {
          describe('applications', () => {
            let intuneApplications: InstanceElement[]
            beforeEach(async () => {
              intuneApplications = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplication')
            })

            it('should create the correct instances for Intune applications', async () => {
              expect(intuneApplications).toHaveLength(6)

              const intuneApplicationNames = intuneApplications.map(e => e.elemID.name)
              expect(intuneApplicationNames).toEqual(
                expect.arrayContaining([
                  'iosStoreApp_test',
                  'androidStoreApp_com_test@uv',
                  'androidManagedStoreApp_com_test@uv',
                  'managedIOSStoreApp_test',
                  'managedAndroidStoreApp_com_test2@uv',
                  'managedAndroidStoreApp_com_test@uv',
                ]),
              )
            })

            it('should create the Intune application instances with the correct path', async () => {
              const intuneApplicationParts = intuneApplications.map(e => e.path)
              expect(intuneApplicationParts).toEqual(
                expect.arrayContaining([
                  ['microsoft_security', 'Records', 'IntuneApplication', 'iosStoreApp', 'test'],
                  ['microsoft_security', 'Records', 'IntuneApplication', 'androidStoreApp', 'com_test'],
                  ['microsoft_security', 'Records', 'IntuneApplication', 'androidManagedStoreApp', 'com_test'],
                  ['microsoft_security', 'Records', 'IntuneApplication', 'managedIOSStoreApp', 'test'],
                  ['microsoft_security', 'Records', 'IntuneApplication', 'managedAndroidStoreApp', 'com_test2'],
                  ['microsoft_security', 'Records', 'IntuneApplication', 'managedAndroidStoreApp', 'com_test'],
                ]),
              )
            })

            it('should include assignments field with references to the matching groups and filters', async () => {
              const applicationWithAssignments = intuneApplications.find(
                e => e.elemID.name === 'managedAndroidStoreApp_com_test@uv',
              )
              expect(applicationWithAssignments).toBeDefined()
              const { assignments } = (applicationWithAssignments as InstanceElement).value
              expect(assignments).toHaveLength(2)
              expect(
                assignments.every((a: Values) => Object.keys(a).length === 2 && 'target' in a && 'source' in a),
              ).toBeTruthy()
              // group reference
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
              expect(assignments[1].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[1].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.another_test_group@s',
              )
              // filter reference
              const filterRefs = assignments.map((a: Values) => a.target?.deviceAndAppManagementAssignmentFilterId)
              expect(filterRefs.every((f: unknown) => f instanceof ReferenceExpression)).toBeTruthy()
              expect(filterRefs.map((f: ReferenceExpression) => f.elemID.getFullName())).toEqual(
                expect.arrayContaining([
                  'microsoft_security.IntuneFilter.instance.test_filter_IOS_iOSMobileApplicationManagement@ssu',
                  'microsoft_security.IntuneFilter.instance.test_filter_android_androidMobileApplicationManagement@ssu',
                ]),
              )
            })

            it('should include assignments field as empty array when there are no assignments', async () => {
              const applicationsWithoutAssignments = intuneApplications.filter(
                e => e.elemID.name !== 'managedAndroidStoreApp_com_test@uv',
              )
              expect(applicationsWithoutAssignments).toHaveLength(5)
              expect(applicationsWithoutAssignments.every(e => e.value.assignments?.length === 0)).toBeTruthy()
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const applicationWithScopeTags = intuneApplications.find(
                e => e.elemID.name === 'managedAndroidStoreApp_com_test@uv',
              )
              expect(applicationWithScopeTags).toBeDefined()
              const { roleScopeTagIds } = (applicationWithScopeTags as InstanceElement).value
              expect(roleScopeTagIds).toHaveLength(2)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual(
                expect.arrayContaining([
                  'microsoft_security.IntuneScopeTag.instance.Default',
                  'microsoft_security.IntuneScopeTag.instance.test_scope_tag@s',
                ]),
              )
            })
          })

          describe('application configurations - managed apps', () => {
            let intuneApplicationConfigurations: InstanceElement[]
            beforeEach(async () => {
              intuneApplicationConfigurations = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationConfigurationManagedApp')
            })

            it('should create the correct instances for Intune application configurations', async () => {
              expect(intuneApplicationConfigurations).toHaveLength(1)

              const intuneApplicationConfigurationNames = intuneApplicationConfigurations.map(e => e.elemID.name)
              expect(intuneApplicationConfigurationNames).toEqual(expect.arrayContaining(['test_configuration@s']))
            })

            it('should create the Intune application configuration instances with the correct path', async () => {
              const intuneApplicationConfigurationParts = intuneApplicationConfigurations.map(e => e.path)
              expect(intuneApplicationConfigurationParts).toEqual(
                expect.arrayContaining([
                  ['microsoft_security', 'Records', 'IntuneApplicationConfigurationManagedApp', 'test_configuration'],
                ]),
              )
            })

            it('should reference the correct target application', async () => {
              const intuneApplicationConfiguration = intuneApplicationConfigurations[0]
              const targetApps = intuneApplicationConfiguration.value.apps
              expect(targetApps).toHaveLength(1)
              expect(targetApps[0]).toEqual({
                mobileAppIdentifier: {
                  '_odata_type@mv': '#microsoft.graph.androidMobileAppIdentifier',
                  packageId: expect.any(ReferenceExpression),
                },
              })
              expect(targetApps[0].mobileAppIdentifier.packageId.elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedAndroidStoreApp_com_test2@uv',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const intuneApplicationConfiguration = intuneApplicationConfigurations[0]
              const { assignments } = intuneApplicationConfiguration.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['intent', 'source', 'target', 'settings'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneApplicationConfiguration = intuneApplicationConfigurations[0]
              const { roleScopeTagIds } = intuneApplicationConfiguration.value
              expect(roleScopeTagIds).toHaveLength(2)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual(
                expect.arrayContaining([
                  'microsoft_security.IntuneScopeTag.instance.Default',
                  'microsoft_security.IntuneScopeTag.instance.test_scope_tag@s',
                ]),
              )
            })
          })

          describe('application configurations - managed devices', () => {
            let intuneApplicationConfigurations: InstanceElement[]
            beforeEach(async () => {
              intuneApplicationConfigurations = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationConfigurationManagedDevice')
            })

            it('should create the correct instances for Intune application configurations', async () => {
              expect(intuneApplicationConfigurations).toHaveLength(2)

              const intuneApplicationConfigurationNames = intuneApplicationConfigurations.map(e => e.elemID.name)
              expect(intuneApplicationConfigurationNames).toEqual(
                expect.arrayContaining(['test_android@s', 'test_ios@s']),
              )
            })

            it('should create the Intune application configuration instances with the correct path', async () => {
              const intuneApplicationConfigurationParts = intuneApplicationConfigurations.map(e => e.path)
              expect(intuneApplicationConfigurationParts).toEqual(
                expect.arrayContaining([
                  ['microsoft_security', 'Records', 'IntuneApplicationConfigurationManagedDevice', 'test_android'],
                  ['microsoft_security', 'Records', 'IntuneApplicationConfigurationManagedDevice', 'test_ios'],
                ]),
              )
            })

            it('should reference the correct target mobile apps', async () => {
              const iosIdx = intuneApplicationConfigurations.findIndex(e => e.elemID.name === 'test_ios@s')
              const intuneApplicationConfigurationIos = intuneApplicationConfigurations[iosIdx]
              const targetMobileAppsIos = intuneApplicationConfigurationIos.value.targetedMobileApps
              expect(targetMobileAppsIos).toHaveLength(1)
              expect(targetMobileAppsIos[0]).toBeInstanceOf(ReferenceExpression)
              expect(targetMobileAppsIos[0].elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedIOSStoreApp_test',
              )

              const androidIdx = intuneApplicationConfigurations.findIndex(e => e.elemID.name === 'test_android@s')
              const intuneApplicationConfigurationAndroid = intuneApplicationConfigurations[androidIdx]
              const targetMobileAppsAndroid = intuneApplicationConfigurationAndroid.value.targetedMobileApps
              expect(targetMobileAppsAndroid).toHaveLength(1)
              expect(targetMobileAppsAndroid[0]).toBeInstanceOf(ReferenceExpression)
              expect(targetMobileAppsAndroid[0].elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedAndroidStoreApp_com_test@uv',
              )
            })

            it('should parse the payloadJson field correctly', async () => {
              const androidIdx = intuneApplicationConfigurations.findIndex(e => e.elemID.name === 'test_android@s')
              const intuneApplicationConfigurationAndroid = intuneApplicationConfigurations[androidIdx]
              expect(intuneApplicationConfigurationAndroid.value.payloadJson).toEqual({
                kind: 'androidenterprise#managedConfiguration',
                productId: 'app:com.microsoft.launcher.enterprise',
                managedProperty: [
                  {
                    key: 'show_volume_setting',
                    valueBool: false,
                  },
                  {
                    key: 'screen_saver_image',
                    valueString: 'hehe',
                  },
                ],
              })
            })

            it('should parse the encodedSettingXml field correctly', async () => {
              const iosIdx = intuneApplicationConfigurations.findIndex(e => e.elemID.name === 'test_ios@s')
              const intuneApplicationConfigurationIos = intuneApplicationConfigurations[iosIdx]
              expect(intuneApplicationConfigurationIos.value.encodedSettingXml).toEqual({
                dict: {
                  key: 'hi',
                  string: 'bye',
                },
              })
            })

            it('should include assignments field with references to the matching groups', async () => {
              const intuneApplicationConfigurationWithAssignments = intuneApplicationConfigurations.find(
                e => e.elemID.name === 'test_ios@s',
              )
              expect(intuneApplicationConfigurationWithAssignments).toBeDefined()
              const { assignments } = (intuneApplicationConfigurationWithAssignments as InstanceElement).value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['intent', 'source', 'target', 'settings'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include assignments field as empty array when there are no assignments', async () => {
              const intuneApplicationConfigurationWithoutAssignments = intuneApplicationConfigurations.find(
                e => e.elemID.name === 'test_android@s',
              )
              expect(intuneApplicationConfigurationWithoutAssignments).toBeDefined()
              const { assignments } = (intuneApplicationConfigurationWithoutAssignments as InstanceElement).value
              expect(assignments).toHaveLength(0)
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneApplicationConfiguration = intuneApplicationConfigurations.find(
                e => e.elemID.name === 'test_android@s',
              )
              expect(intuneApplicationConfiguration).toBeDefined()
              const { roleScopeTagIds } = (intuneApplicationConfiguration as InstanceElement).value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('device configurations', () => {
            let intuneDeviceConfigurations: InstanceElement[]
            beforeEach(async () => {
              intuneDeviceConfigurations = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneDeviceConfiguration')
            })

            it('should create the correct instances for Intune device configurations', async () => {
              expect(intuneDeviceConfigurations).toHaveLength(5)

              const intuneDeviceConfigurationNames = intuneDeviceConfigurations.map(e => e.elemID.name)
              expect(intuneDeviceConfigurationNames).toEqual(
                expect.arrayContaining([
                  'test_custom_template@s',
                  'test_ios_email_configuration@s',
                  'test_wifi_configuration@s',
                  'test_windows_10_email_configuration@s',
                  'test_windows_health_monitoring@s',
                ]),
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const intuneDeviceConfigurationWithAssignments = intuneDeviceConfigurations.find(
                e => e.elemID.name === 'test_windows_health_monitoring@s',
              )
              expect(intuneDeviceConfigurationWithAssignments).toBeDefined()
              const { assignments } = (intuneDeviceConfigurationWithAssignments as InstanceElement).value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['intent', 'source', 'target', 'settings'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include assignments field as empty array when there are no assignments', async () => {
              const intuneDeviceConfigurationWithoutAssignments = intuneDeviceConfigurations.filter(
                e => e.elemID.name !== 'test_windows_health_monitoring@s',
              )
              expect(intuneDeviceConfigurationWithoutAssignments).toHaveLength(4)
              expect(
                intuneDeviceConfigurationWithoutAssignments.every(e => e.value.assignments?.length === 0),
              ).toBeTruthy()
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneDeviceConfiguration = intuneDeviceConfigurations.find(
                e => e.elemID.name === 'test_windows_health_monitoring@s',
              )
              expect(intuneDeviceConfiguration).toBeDefined()
              const { roleScopeTagIds } = (intuneDeviceConfiguration as InstanceElement).value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })

            it('should convert payload field to a static file', async () => {
              const intuneDeviceConfiguration = intuneDeviceConfigurations.find(
                e => e.elemID.name === 'test_custom_template@s',
              )
              expect(intuneDeviceConfiguration).toBeDefined()
              const { payload } = (intuneDeviceConfiguration as InstanceElement).value
              expect(payload).toBeInstanceOf(StaticFile)
              expect(payload.filepath).toEqual(
                'microsoft_security/IntuneDeviceConfiguration/test_custom_template.s/example.xml',
              )
              expect(payload.encoding).toEqual('base64')
              const payloadContent = await payload.getContent()
              expect(payloadContent).toBeInstanceOf(Buffer)
              expect(payloadContent.toString()).toEqual('<note>This is a test</note>')
            })
          })

          describe('device configurations - setting catalog', () => {
            let intuneDeviceConfigurationSettingCatalogs: InstanceElement[]
            beforeEach(async () => {
              intuneDeviceConfigurationSettingCatalogs = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneDeviceConfigurationSettingCatalog')
            })

            it('should create the correct instances for Intune device configuration setting catalogs', async () => {
              expect(intuneDeviceConfigurationSettingCatalogs).toHaveLength(1)

              const intuneDeviceConfigurationSettingCatalogNames = intuneDeviceConfigurationSettingCatalogs.map(
                e => e.elemID.name,
              )
              expect(intuneDeviceConfigurationSettingCatalogNames).toEqual(
                expect.arrayContaining(['test_setting_catalog_policy@s']),
              )
            })

            it('should include the settings field with the correct values', async () => {
              const intuneDeviceConfigurationSettingCatalog = intuneDeviceConfigurationSettingCatalogs[0]
              expect(intuneDeviceConfigurationSettingCatalog.value.settings).toHaveLength(10)
              expect(Object.keys(intuneDeviceConfigurationSettingCatalog.value.settings[0])).toEqual([
                'settingInstance',
              ])
            })

            it('should include the assignments field with references to the matching groups', async () => {
              const intuneDeviceConfigurationSettingCatalog = intuneDeviceConfigurationSettingCatalogs[0]
              const { assignments } = intuneDeviceConfigurationSettingCatalog.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['intent', 'source', 'target', 'settings'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneDeviceConfigurationSettingCatalog = intuneDeviceConfigurationSettingCatalogs[0]
              const { roleScopeTagIds } = intuneDeviceConfigurationSettingCatalog.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('device compliances', () => {
            let intuneDeviceCompliances: InstanceElement[]
            beforeEach(async () => {
              intuneDeviceCompliances = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneDeviceCompliance')
            })

            it('should create the correct instances for Intune device compliances', async () => {
              expect(intuneDeviceCompliances).toHaveLength(1)

              const intuneDeviceComplianceNames = intuneDeviceCompliances.map(e => e.elemID.name)
              expect(intuneDeviceComplianceNames).toEqual(expect.arrayContaining(['test_IOS@s']))
            })

            it('should add a reference to the correct intune application', async () => {
              const intuneDeviceCompliance = intuneDeviceCompliances[0]
              const groupRef = intuneDeviceCompliance.value.restrictedApps[0]?.appId
              expect(groupRef).toBeInstanceOf(ReferenceExpression)
              expect(groupRef.elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedIOSStoreApp_test',
              )
            })

            it('should include scheduledActionsForRule field with the correct values', async () => {
              const intuneDeviceCompliance = intuneDeviceCompliances[0]

              const { scheduledActionsForRule } = intuneDeviceCompliance.value
              expect(scheduledActionsForRule).toHaveLength(1)
              expect(Object.keys(scheduledActionsForRule[0])).toEqual(['scheduledActionConfigurations'])

              const { scheduledActionConfigurations } = scheduledActionsForRule[0]
              expect(scheduledActionConfigurations).toHaveLength(1)
              expect(Object.keys(scheduledActionConfigurations[0])).toEqual([
                'gracePeriodHours',
                'actionType',
                'notificationTemplateId',
                'notificationMessageCCList',
              ])
            })

            it('should include assignments field with references to the matching groups', async () => {
              const intuneDeviceCompliance = intuneDeviceCompliances[0]
              const { assignments } = intuneDeviceCompliance.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['intent', 'source', 'target', 'settings'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneDeviceCompliance = intuneDeviceCompliances[0]
              const { roleScopeTagIds } = intuneDeviceCompliance.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('filter', () => {
            let intuneFilters: InstanceElement[]
            beforeEach(async () => {
              intuneFilters = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'IntuneFilter')
            })

            it('should create the correct instances for Intune filters', async () => {
              expect(intuneFilters).toHaveLength(2)

              const intuneFilterNames = intuneFilters.map(e => e.elemID.name)
              expect(intuneFilterNames).toEqual(
                expect.arrayContaining([
                  'test_filter_android_androidMobileApplicationManagement@ssu',
                  'test_filter_IOS_iOSMobileApplicationManagement@ssu',
                ]),
              )
            })

            it("should not include 'payloads' field", async () => {
              expect(intuneFilters.every(e => !('payloads' in e.value))).toBeTruthy()
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const intuneFilter = intuneFilters[0]
              const { roleScopeTags } = intuneFilter.value
              expect(roleScopeTags).toHaveLength(1)
              expect(roleScopeTags.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTags.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('platform script linux', () => {
            let platformScriptsLinux: InstanceElement[]
            beforeEach(async () => {
              platformScriptsLinux = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntunePlatformScriptLinux')
            })

            it('should create the correct instances for platform script linux', async () => {
              expect(platformScriptsLinux).toHaveLength(1)

              const platformScriptLinuxNames = platformScriptsLinux.map(e => e.elemID.name)
              expect(platformScriptLinuxNames).toEqual(['test_linux_script@s'])
            })

            it('should include settings field with the correct values', async () => {
              const platformScriptLinux = platformScriptsLinux[0]
              expect(platformScriptLinux.value.settings).toHaveLength(4)
              expect(Object.keys(platformScriptLinux.value.settings[0])).toEqual(['settingInstance'])
              const linuxScript = _.get(platformScriptLinux.value.settings[3], [
                'settingInstance',
                'simpleSettingValue',
                'value',
              ])
              expect(linuxScript).toBeInstanceOf(StaticFile)
              const scriptContent = await linuxScript.getContent()
              expect(scriptContent).toBeInstanceOf(Buffer)
              expect(scriptContent.toString()).toEqual(
                '#!/bin/bash\n\n# This is a simple bash script example.\n\n# Print a welcome message\necho "Welcome to the dummy bash script!"\n',
              )
              expect(linuxScript.encoding).toEqual('base64')
              expect(linuxScript.filepath).toEqual(
                'microsoft_security/IntunePlatformScriptLinux/test_linux_script.s/linux_customconfig_script.sh',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const platformScriptLinux = platformScriptsLinux[0]
              const { assignments } = platformScriptLinux.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['source', 'target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const platformScriptLinux = platformScriptsLinux[0]
              const { roleScopeTagIds } = platformScriptLinux.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('platform script windows', () => {
            let platformScriptsWindows: InstanceElement[]
            beforeEach(async () => {
              platformScriptsWindows = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntunePlatformScriptWindows')
            })

            it('should create the correct instances for platform script windows', async () => {
              expect(platformScriptsWindows).toHaveLength(1)

              const platformScriptWindowsNames = platformScriptsWindows.map(e => e.elemID.name)
              expect(platformScriptWindowsNames).toEqual(['test_windows_platform_script@s'])
            })

            it('should include scriptContent field as a static file', async () => {
              const platformScriptWindows = platformScriptsWindows[0]
              const { scriptContent } = platformScriptWindows.value
              expect(scriptContent).toBeInstanceOf(StaticFile)
              const content = await scriptContent.getContent()
              expect(content).toBeInstanceOf(Buffer)
              expect(content.toString()).toEqual('echo "Hello, World!"')
              expect(scriptContent.encoding).toEqual('base64')
              expect(scriptContent.filepath).toEqual(
                'microsoft_security/IntunePlatformScriptWindows/test_windows_platform_script.s/simple_powershell_script.ps1',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const platformScriptWindows = platformScriptsWindows[0]
              const { assignments } = platformScriptWindows.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const platformScriptWindows = platformScriptsWindows[0]
              const { roleScopeTagIds } = platformScriptWindows.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('platform script macOS', () => {
            let platformScriptsMacOS: InstanceElement[]
            beforeEach(async () => {
              platformScriptsMacOS = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntunePlatformScriptMacOS')
            })

            it('should create the correct instances for platform script macOS', async () => {
              expect(platformScriptsMacOS).toHaveLength(1)

              const platformScriptMacOSNames = platformScriptsMacOS.map(e => e.elemID.name)
              expect(platformScriptMacOSNames).toEqual(['test_script_macOS@s'])
            })

            it('should include scriptContent field as a static file', async () => {
              const platformScriptMacOS = platformScriptsMacOS[0]
              const { scriptContent } = platformScriptMacOS.value
              expect(scriptContent).toBeInstanceOf(StaticFile)
              const content = await scriptContent.getContent()
              expect(content).toBeInstanceOf(Buffer)
              expect(content.toString()).toEqual('echo "Hello, World! This is macOS test"')
              expect(scriptContent.encoding).toEqual('base64')
              expect(scriptContent.filepath).toEqual(
                'microsoft_security/IntunePlatformScriptMacOS/test_script_macOS.s/intune-macOS-script-example.sh',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const platformScriptMacOS = platformScriptsMacOS[0]
              const { assignments } = platformScriptMacOS.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const platformScriptMacOS = platformScriptsMacOS[0]
              const { roleScopeTagIds } = platformScriptMacOS.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('scope tags', () => {
            let scopeTags: InstanceElement[]
            beforeEach(async () => {
              scopeTags = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'IntuneScopeTag')
            })

            it('should create the correct instances for Intune scope tags', async () => {
              expect(scopeTags).toHaveLength(2)

              const scopeTagNames = scopeTags.map(e => e.elemID.name)
              expect(scopeTagNames).toEqual(expect.arrayContaining(['Default', 'test_scope_tag@s']))
            })

            it('should include assignments field with references to the matching groups', async () => {
              const scopeTag = scopeTags.find(e => e.elemID.name === 'test_scope_tag@s') as InstanceElement
              const { assignments } = scopeTag.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include assignments field as empty array when there are no assignments', async () => {
              const scopeTag = scopeTags.find(e => e.elemID.name === 'Default') as InstanceElement
              const { assignments } = scopeTag.value
              expect(assignments).toHaveLength(0)
            })
          })

          describe('application protection android', () => {
            let applicationProtectionAndroids: InstanceElement[]
            beforeEach(async () => {
              applicationProtectionAndroids = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationProtectionAndroid')
            })

            it('should create the correct instances for Intune application protection android', async () => {
              expect(applicationProtectionAndroids).toHaveLength(1)

              const applicationProtectionAndroidNames = applicationProtectionAndroids.map(e => e.elemID.name)
              expect(applicationProtectionAndroidNames).toEqual(['test_android_protection@s'])
            })

            it('should reference the correct target application', async () => {
              const applicationProtectionAndroid = applicationProtectionAndroids[0]
              const targetApps = applicationProtectionAndroid.value.apps
              expect(targetApps).toHaveLength(1)
              expect(targetApps[0]).toEqual({
                mobileAppIdentifier: {
                  '_odata_type@mv': '#microsoft.graph.androidMobileAppIdentifier',
                  packageId: expect.any(ReferenceExpression),
                },
              })
              expect(targetApps[0].mobileAppIdentifier.packageId.elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedAndroidStoreApp_com_test@uv',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const applicationProtectionAndroid = applicationProtectionAndroids[0]
              const { assignments } = applicationProtectionAndroid.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['source', 'target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const applicationProtectionAndroid = applicationProtectionAndroids[0]
              const { roleScopeTagIds } = applicationProtectionAndroid.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('application protection iOS', () => {
            let applicationProtectionIOSs: InstanceElement[]
            beforeEach(async () => {
              applicationProtectionIOSs = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationProtectionIOS')
            })

            it('should create the correct instances for Intune application protection iOS', async () => {
              expect(applicationProtectionIOSs).toHaveLength(1)

              const applicationProtectionIOSNames = applicationProtectionIOSs.map(e => e.elemID.name)
              expect(applicationProtectionIOSNames).toEqual(['test_IOS_protection@s'])
            })

            it('should reference the correct target application', async () => {
              const applicationProtectionIOS = applicationProtectionIOSs[0]
              const targetApps = applicationProtectionIOS.value.apps
              expect(targetApps).toHaveLength(1)
              expect(targetApps[0]).toEqual({
                mobileAppIdentifier: {
                  '_odata_type@mv': '#microsoft.graph.iosMobileAppIdentifier',
                  bundleId: expect.any(ReferenceExpression),
                },
              })
              expect(targetApps[0].mobileAppIdentifier.bundleId.elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedIOSStoreApp_test',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const applicationProtectionIOS = applicationProtectionIOSs[0]
              const { assignments } = applicationProtectionIOS.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['source', 'target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const applicationProtectionIOS = applicationProtectionIOSs[0]
              const { roleScopeTagIds } = applicationProtectionIOS.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('application protection windows', () => {
            let applicationProtectionsWindows: InstanceElement[]
            beforeEach(async () => {
              applicationProtectionsWindows = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationProtectionWindows')
            })

            it('should create the correct instances for Intune application protection windows', async () => {
              expect(applicationProtectionsWindows).toHaveLength(1)

              const applicationProtectionWindowsNames = applicationProtectionsWindows.map(e => e.elemID.name)
              expect(applicationProtectionWindowsNames).toEqual(['test_windows_protection@s'])
            })

            it('should reference the correct target application', async () => {
              const applicationProtectionWindows = applicationProtectionsWindows[0]
              const targetApps = applicationProtectionWindows.value.apps
              expect(targetApps).toHaveLength(1)
              expect(targetApps[0]).toEqual({
                mobileAppIdentifier: {
                  '_odata_type@mv': '#microsoft.graph.windowsMobileAppIdentifier',
                  bundleId: expect.any(ReferenceExpression),
                },
              })
              expect(targetApps[0].mobileAppIdentifier.bundleId.elemID.getFullName()).toEqual(
                'microsoft_security.IntuneApplication.instance.managedIOSStoreApp_test',
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const applicationProtectionWindows = applicationProtectionsWindows[0]
              const { assignments } = applicationProtectionWindows.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['source', 'target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const applicationProtectionWindows = applicationProtectionsWindows[0]
              const { roleScopeTagIds } = applicationProtectionWindows.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })

          describe('application protection windows information protection', () => {
            let applicationProtectionWindowsInformationProtections: InstanceElement[]
            beforeEach(async () => {
              applicationProtectionWindowsInformationProtections = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneApplicationProtectionWindowsInformationProtection')
            })

            it('should create the correct instances for Intune application protection windows information protection', async () => {
              expect(applicationProtectionWindowsInformationProtections).toHaveLength(1)

              const applicationProtectionWindowsInformationProtectionNames =
                applicationProtectionWindowsInformationProtections.map(e => e.elemID.name)
              expect(applicationProtectionWindowsInformationProtectionNames).toEqual(
                expect.arrayContaining(['test_windows_information_protection@s']),
              )
            })

            it('should include assignments field with references to the matching groups', async () => {
              const applicationProtectionWindowsInformationProtection =
                applicationProtectionWindowsInformationProtections[0]
              const { assignments } = applicationProtectionWindowsInformationProtection.value
              expect(assignments).toHaveLength(1)
              expect(Object.keys(assignments[0])).toEqual(['source', 'target'])
              expect(assignments[0].target?.groupId).toBeInstanceOf(ReferenceExpression)
              expect(assignments[0].target.groupId.value.elemID.getFullName()).toEqual(
                'microsoft_security.EntraGroup.instance.Custom_group_rename@s',
              )
            })

            it('should include scope tags field with references to the matching scope tags', async () => {
              const applicationProtectionWindowsInformationProtection =
                applicationProtectionWindowsInformationProtections[0]
              const { roleScopeTagIds } = applicationProtectionWindowsInformationProtection.value
              expect(roleScopeTagIds).toHaveLength(1)
              expect(roleScopeTagIds.every((s: unknown) => s instanceof ReferenceExpression)).toBeTruthy()
              expect(roleScopeTagIds.map((s: ReferenceExpression) => s.elemID.getFullName())).toEqual([
                'microsoft_security.IntuneScopeTag.instance.Default',
              ])
            })
          })
        })
      })
    })

    describe('Entra', () => {
      let elements: Element[]
      beforeEach(async () => {
        ;({ elements } = await setup({ Entra: true, Intune: false }))
      })

      it('should generate the right elements on fetch', async () => {
        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'EntraAdministrativeUnit',
          'EntraAppRole',
          'EntraApplication',
          'EntraAuthenticationMethodPolicy',
          'EntraAuthenticationMethodPolicy__authenticationMethodConfigurations',
          'EntraAuthenticationStrengthPolicy',
          'EntraConditionalAccessPolicy',
          'EntraConditionalAccessPolicyNamedLocation',
          'EntraCrossTenantAccessPolicy',
          'EntraCustomSecurityAttributeDefinition',
          'EntraCustomSecurityAttributeDefinition__allowedValues',
          'EntraCustomSecurityAttributeSet',
          'EntraDirectoryRoleTemplate',
          'EntraDomain',
          'EntraGroup',
          'EntraGroupLifeCyclePolicy',
          'EntraGroup__appRoleAssignments',
          'EntraOauth2PermissionGrant',
          'EntraPermissionGrantPolicy',
          'EntraRoleDefinition',
          'EntraServicePrincipal',
        ])
      })
    })

    describe('Intune', () => {
      let elements: Element[]
      beforeEach(async () => {
        ;({ elements } = await setup({ Entra: false, Intune: true }))
      })

      it('should generate the right elements on fetch', async () => {
        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'EntraGroup',
          'IntuneApplication',
          'IntuneApplicationConfigurationManagedApp',
          'IntuneApplicationConfigurationManagedDevice',
          'IntuneApplicationProtectionAndroid',
          'IntuneApplicationProtectionIOS',
          'IntuneApplicationProtectionWindows',
          'IntuneApplicationProtectionWindowsInformationProtection',
          'IntuneDeviceCompliance',
          'IntuneDeviceConfiguration',
          'IntuneDeviceConfigurationSettingCatalog',
          'IntuneFilter',
          'IntunePlatformScriptLinux',
          'IntunePlatformScriptMacOS',
          'IntunePlatformScriptWindows',
          'IntuneScopeTag',
        ])
      })
    })
  })
  // TODO: implement deploy UTs
})
