/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { StaticFile } from '@salto-io/adapter-api'
import { deviceConfigurationSettings } from '../../../../../src/definitions/fetch/intune/utils'
import { contextMock } from '../../../../mocks'

describe('Intune device configuration settings fetch utils', () => {
  describe(`${deviceConfigurationSettings.setScriptValueAsStaticFile.name}`, () => {
    const SETTING_WITHOUT_A_SCRIPT_0 = {
      settingInstance: {
        '_odata_type@mv': '#microsoft.graph.deviceManagementConfigurationChoiceSettingInstance',
        settingDefinitionId: 'linux_customconfig_executioncontext',
        settingInstanceTemplateReference: {
          settingInstanceTemplateId: '2c59a6c5-e874-445b-ac5a-d53688ef838e',
        },
        choiceSettingValue: {
          value: 'linux_customconfig_executioncontext_root',
          settingValueTemplateReference: {
            settingValueTemplateId: '119f0327-4114-444a-b53d-4b55fd579e43',
            useTemplateDefault: false,
          },
        },
      },
    }
    const SETTING_WITHOUT_A_SCRIPT_1 = {
      settingInstance: {
        '_odata_type@mv': '#microsoft.graph.deviceManagementConfigurationChoiceSettingInstance',
        settingDefinitionId: 'linux_customconfig_executionfrequency',
        settingInstanceTemplateReference: {
          settingInstanceTemplateId: 'f42b866f-ff2b-4d19-bef8-63e7c763d49b',
        },
        choiceSettingValue: {
          value: 'linux_customconfig_executionfrequency_1week',
          settingValueTemplateReference: {
            settingValueTemplateId: 'd0fb527e-606e-455f-891d-2a4de6a5db90',
            useTemplateDefault: false,
          },
        },
      },
    }
    const SETTING_WITHOUT_A_SCRIPT_2 = {
      settingInstance: {
        '_odata_type@mv': '#microsoft.graph.deviceManagementConfigurationChoiceSettingInstance',
        settingDefinitionId: 'linux_customconfig_executionretries',
        settingInstanceTemplateReference: {
          settingInstanceTemplateId: 'a3326517-152b-4b32-bc11-8772b5b4fe6a',
        },
        choiceSettingValue: {
          value: 'linux_customconfig_executionretries_0',
          settingValueTemplateReference: {
            settingValueTemplateId: '92b31053-6ebb-4d2d-9e4d-081fe15d5d21',
            useTemplateDefault: false,
          },
        },
      },
    }
    const SETTING_WITH_A_SCRIPT = {
      settingInstance: {
        '_odata_type@mv': '#microsoft.graph.deviceManagementConfigurationSimpleSettingInstance',
        settingDefinitionId: 'linux_customconfig_script',
        settingInstanceTemplateReference: {
          settingInstanceTemplateId: 'add4347a-f9aa-4202-a497-34a4c178d013',
        },
        simpleSettingValue: {
          '_odata_type@mv': '#microsoft.graph.deviceManagementConfigurationStringSettingValue',
          value:
            'IyEvYmluL2Jhc2gKCiMgVGhpcyBpcyBhIHNpbXBsZSBiYXNoIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQplY2hvICJXZWxjb21lIHRvIHRoZSBkdW1teSBiYXNoIHNjcmlwdCEiCg==',
          settingValueTemplateReference: {
            settingValueTemplateId: '18dc8a98-2ecd-4753-8baf-3ab7a1d677a9',
            useTemplateDefault: false,
          },
        },
      },
    }
    const SETTINGS_WITHOUT_A_SCRIPT = [
      SETTING_WITHOUT_A_SCRIPT_0,
      SETTING_WITHOUT_A_SCRIPT_1,
      SETTING_WITHOUT_A_SCRIPT_2,
    ]

    const PLATFORM_SCRIPT_VALUE_WITH_SETTINGS = {
      platforms: 'linux',
      settings: [...SETTINGS_WITHOUT_A_SCRIPT, SETTING_WITH_A_SCRIPT],
    }

    describe('when the instance has no settings', () => {
      it('should return the value as is', async () => {
        const value = _.omit(PLATFORM_SCRIPT_VALUE_WITH_SETTINGS, 'settings')
        expect(
          await deviceConfigurationSettings.setScriptValueAsStaticFile({
            value,
            typeName: 'testPlatformScript',
            context: { ...contextMock, fragments: [] },
          }),
        ).toEqual({ value })
      })
    })

    describe('when the instance has settings', () => {
      it('should set the script value as a static file', async () => {
        const value = PLATFORM_SCRIPT_VALUE_WITH_SETTINGS
        const expectedSettings = [
          ...SETTINGS_WITHOUT_A_SCRIPT,
          {
            settingInstance: {
              ...SETTING_WITH_A_SCRIPT.settingInstance,
              simpleSettingValue: {
                ...SETTING_WITH_A_SCRIPT.settingInstance.simpleSettingValue,
                value: expect.any(StaticFile),
              },
            },
          },
        ]
        const expectedValue = {
          ...value,
          settings: expectedSettings,
        }
        expect(
          await deviceConfigurationSettings.setScriptValueAsStaticFile({
            value,
            typeName: 'testPlatformScript',
            context: { ...contextMock, fragments: [] },
          }),
        ).toEqual({ value: expectedValue })
      })
    })
  })
})
