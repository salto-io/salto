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
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/client/oauth'
import { DEFAULT_CONFIG } from '../src/config'
import fetchMockReplies from './fetch_mock_replies.json'

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
    describe('full', () => {
      let elements: Element[]
      beforeEach(async () => {
        ;({ elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              tenantId: 'testTenantId',
              clientId: 'testClientId',
              clientSecret: 'testClient',
              refreshToken: 'testRefreshToken',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } }))
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
          'IntuneDeviceCompliance',
          'IntuneDeviceConfiguration',
          'IntuneDeviceConfigurationSettingCatalog',
          'IntuneFilter',
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
          })

          describe('device configurations', () => {
            let intuneDeviceConfigurations: InstanceElement[]
            beforeEach(async () => {
              intuneDeviceConfigurations = elements
                .filter(isInstanceElement)
                .filter(e => e.elemID.typeName === 'IntuneDeviceConfiguration')
            })

            it('should create the correct instances for Intune device configurations', async () => {
              expect(intuneDeviceConfigurations).toHaveLength(4)

              const intuneDeviceConfigurationNames = intuneDeviceConfigurations.map(e => e.elemID.name)
              expect(intuneDeviceConfigurationNames).toEqual(
                expect.arrayContaining([
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
              expect(intuneDeviceConfigurationWithoutAssignments).toHaveLength(3)
              expect(
                intuneDeviceConfigurationWithoutAssignments.every(e => e.value.assignments?.length === 0),
              ).toBeTruthy()
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
          })
        })
      })
    })
  })
  // TODO: implement deploy UTs
})
