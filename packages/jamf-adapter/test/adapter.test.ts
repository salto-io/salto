/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  AdapterOperations,
  Change,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ProgressReporter,
  toChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import {
  ADAPTER_NAME,
  API_ROLE_TYPE_NAME,
  BUILDING_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CLASS_TYPE_NAME,
  DEPARTMENT_TYPE_NAME,
  PACKAGE_TYPE_NAME,
  POLICY_TYPE_NAME,
  SCRIPT_TYPE_NAME,
  SITE_TYPE_NAME,
} from '../src/constants'
import fetchMockReplies from './fetch_mock_replies.json'
import deployMockReplies from './deploy_mock_replies.json'
import { VALIDATE_CREDENTIALS_URL } from '../src/client/connection'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => '',
}

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: definitions.HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

describe('adapter', () => {
  jest.setTimeout(1000 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter
      .onPost('https://baseUrl.com/api/oauth/token')
      .reply(200, { access_token: 'mock_token', token_type: 'Bearer' })
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      if (url === VALIDATE_CREDENTIALS_URL) {
        handler.reply(200, response)
      } else {
        handler.replyOnce(200, response)
      }
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              baseUrl: 'https://baseUrl.com',
              clientId: 'clientId',
              clientSecret: 'clientSecret',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual(
          [
            BUILDING_TYPE_NAME,
            DEPARTMENT_TYPE_NAME,
            CATEGORY_TYPE_NAME,
            SCRIPT_TYPE_NAME,
            API_ROLE_TYPE_NAME,
            SITE_TYPE_NAME,
            CLASS_TYPE_NAME,
            POLICY_TYPE_NAME,
            PACKAGE_TYPE_NAME,
          ].sort(),
        )
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jamf.api_role',
          'jamf.api_role.instance.2Lior_s_Role@ts',
          'jamf.api_role.instance.allPrivileges',
          'jamf.building',
          'jamf.building.instance.farkash_first_building2@s',
          'jamf.building.instance.farkash_first_building@s',
          'jamf.building.instance.fdsfsfdsfdssadfsdf',
          'jamf.category',
          'jamf.category.instance.farkash_first_category2@s',
          'jamf.category.instance.farkash_first_category@s',
          'jamf.class',
          'jamf.class.instance.This_is_farkash_class_try_to_modify@s',
          'jamf.class.instance.second_class@s',
          'jamf.class__mobile_device_group',
          'jamf.department',
          'jamf.department.instance.farkash_first_department2@s',
          'jamf.department.instance.farkash_first_department@s',
          'jamf.disk_encryption_configuration',
          'jamf.mac_application',
          'jamf.mobile_device_configuration_profile',
          'jamf.os_x_configuration_profile',
          'jamf.package',
          'jamf.package.instance.AdOps_CC_2020_v1_Install_pkg@sssuv',
          'jamf.package.instance.AdobeAcrobatPro11CC_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobeAuditionCC2014_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobeBridgeCC_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobeIllustratorCC2014_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobeInCopyCC2014_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobeInDesignCC2014_2014_08_06_pkg@ubbv',
          'jamf.package.instance.AdobePremiereProCC2014_2014_08_06_pkg@ubbv',
          'jamf.package.instance.BalsamiqMockups2222_2014_09_08_pkg@ubbv',
          'jamf.package.instance.DiffMerge420_2014_08_10_pkg@ubbv',
          'jamf.package.instance.Firefox567_dmg@v',
          'jamf.package.instance.RubyMine633_2014_07_29_pkg@ubbv',
          'jamf.policy',
          'jamf.policy.instance.Add_Institutional_Key__Invalid_Individual_Key__Mgmt_Acct_is_FV2_User@ssfssszdsssss',
          'jamf.policy.instance.Add_Institutional_Key__Valid_Individual_Key@ssfsss',
          'jamf.policy.instance.Adobe_Bridge_CC@s',
          'jamf.policy.instance.Adobe_Illustrator_CC_2014@s',
          'jamf.policy.instance.Adobe_InCopy_CC_2014@s',
          'jamf.policy.instance.Adobe_InDesign_CC_2014@s',
          'jamf.policy.instance.Balsamiq_Mockups_for_Desktop@s',
          'jamf.policy.instance.DiffMerge',
          'jamf.policy.instance.Enable_Management_Account_as_FV2_User@s',
          'jamf.policy.instance.Lior_s_first_policy@tss',
          'jamf.policy.instance.Maintenance',
          'jamf.policy.instance.Reset_My_Software_Update_Server@s',
          'jamf.policy.instance.Rotate_Mgmt_Account_Password__On_Enroll__Trigger_@ssssjszdsk',
          'jamf.policy.instance.Rotate_Mgmt_Account_Password__Weekly_@ssssjk',
          'jamf.policy.instance.RubyMine_6@s',
          'jamf.policy.instance.Secure_Print_RPS3@s',
          'jamf.policy.instance.SourceTree',
          'jamf.policy.instance.Try_to_add_policy_under_computers@s',
          'jamf.policy.instance.Update_Inventory@s',
          'jamf.policy__account_maintenance',
          'jamf.policy__account_maintenance__management_account',
          'jamf.policy__account_maintenance__open_firmware_efi_password',
          'jamf.policy__disk_encryption',
          'jamf.policy__files_processes',
          'jamf.policy__general',
          'jamf.policy__general__date_time_limitations',
          'jamf.policy__general__date_time_limitations__no_execute_on',
          'jamf.policy__general__network_limitations',
          'jamf.policy__general__override_default_settings',
          'jamf.policy__maintenance',
          'jamf.policy__package_configuration',
          'jamf.policy__package_configuration__packages',
          'jamf.policy__reboot',
          'jamf.policy__scope',
          'jamf.policy__scope__exclusions',
          'jamf.policy__scope__limit_to_users',
          'jamf.policy__scope__limitations',
          'jamf.policy__scripts',
          'jamf.policy__self_service',
          'jamf.policy__user_interaction',
          'jamf.script',
          'jamf.script.instance.Decrypt_Drive@s',
          'jamf.script.instance.FileVault_EnableMgmtAccountPrompt_sh@uv',
          'jamf.script.instance.Get_Running_Processes@s',
          'jamf.script.instance.IIIIIIIIIInstall_Developer_Utils_Script@s',
          'jamf.script.instance.Install_Developer_Utils_Script@s',
          'jamf.script.instance.RubyMine60License_2014_07_29_sh@ubbv',
          'jamf.script.instance.SourceTree_2014_08_01_sh@ubbv',
          'jamf.script.instance.__AA_Script',
          'jamf.script.instance.__AA_Test',
          'jamf.script.instance.farkash_first_script@s',
          'jamf.script.instance.string',
          'jamf.script.instance.test_this_out_blah@s',
          'jamf.site',
          'jamf.site.instance.farkash_first_site@s',
          'jamf.site.instance.hopa_hey@s',
        ])
        expect(
          elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'jamf.script.instance.__AA_Script')
            ?.value,
        ).toEqual({
          categoryId: '-1',
          id: '11',
          info: '',
          name: '__AA_Script',
          notes: '',
          osRequirements: '',
          parameter10: '',
          parameter11: '',
          parameter4: '',
          parameter5: '',
          parameter6: '',
          parameter7: '',
          parameter8: '',
          parameter9: '',
          priority: 'AFTER',
          scriptContents: 'echo "TEST"',
        })
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations
    let buildingType: ObjectType
    let classType: ObjectType
    let policyType: ObjectType
    let buildingToModify: InstanceElement
    let classToAdd: InstanceElement
    let policyToRemove: InstanceElement
    let policyToModify: InstanceElement
    let policyToAdd: InstanceElement

    beforeEach(() => {
      buildingType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, BUILDING_TYPE_NAME) })
      classType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, CLASS_TYPE_NAME) })
      policyType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, POLICY_TYPE_NAME) })
      buildingToModify = new InstanceElement('buildingToModify', buildingType, {
        id: '4',
        name: 'old name', // to be 'This is a new name',
        streetAddress1: '',
        streetAddress2: '',
        city: '', // to be 'added a city also',
        stateProvince: '',
        zipPostalCode: '',
        country: '',
      })
      classToAdd = new InstanceElement('classToAdd', classType, {
        source: 'N/A',
        name: 'another class',
        description: 'yoyo',
        site: '-1',
      })
      policyToRemove = new InstanceElement('policyToRemove', policyType, { id: 19 })
      policyToAdd = new InstanceElement('policyToAdd', policyType, {
        general: {
          name: 'policyToAdd',
        },
        scripts: [],
      })
      policyToModify = new InstanceElement('policyToModify', policyType, {
        id: 25,
        general: {
          name: 'policyToModify',
        },
        scripts: [],
      })
      operations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, {
          baseUrl: 'https://baseUrl.com',
          clientId: 'clientId',
          clientSecret: 'clientSecret',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([
          classType,
          buildingType,
          policyType,
          buildingToModify,
          policyToRemove,
          policyToAdd,
          policyToModify,
        ]),
      })
    })

    it('should return the applied changes', async () => {
      const results: DeployResult[] = []
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'class',
            changes: [toChange({ after: classToAdd })],
          },
          progressReporter: nullProgressReporter,
        }),
      )
      const buildingToModifyAfter = buildingToModify.clone()
      buildingToModifyAfter.value.name = 'This is a new name'
      buildingToModifyAfter.value.city = 'added a city also'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'building',
            changes: [toChange({ before: buildingToModify, after: buildingToModifyAfter })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'policy',
            changes: [toChange({ before: policyToRemove })],
          },
          progressReporter: nullProgressReporter,
        }),
      )
      const policyToModifyAfter = policyToModify.clone()
      policyToModifyAfter.value.name = 'This is a new name'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'policy',
            changes: [toChange({ before: policyToModify, after: policyToModifyAfter })],
          },
          progressReporter: nullProgressReporter,
        }),
      )
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'policy',
            changes: [toChange({ after: policyToAdd })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1, 1, 1])
      expect(results.map(res => res.errors.length)).toEqual([0, 0, 0, 0, 0])
      const classAddRes = results[0].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(classAddRes).value.id).toEqual(20)
      const policyAddRes = results[4].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(policyAddRes).value.id).toEqual(43)
    })
  })
})
