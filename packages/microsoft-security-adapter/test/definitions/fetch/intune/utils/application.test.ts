/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { StaticFile } from '@salto-io/adapter-api'
import { application } from '../../../../../src/definitions/fetch/intune/utils'
import { contextMock } from '../../../../mocks'
import { intuneConstants, ODATA_TYPE_FIELD } from '../../../../../src/constants'
import { getAdjustedOdataTypeFieldName } from '../../../../../src/utils/shared/odata_type'

const { APPLICATION_TYPE_NAME, SCRIPT_CONTENT_FIELD_NAME } = intuneConstants

describe('Intune application fetch utils', () => {
  describe(application.setApplicationScriptValueAsStaticFile.name, () => {
    describe('win32LobApp', () => {
      const DETECTION_RULES_FIELD_NAME = 'detectionRules'
      const REQUIREMENT_RULES_FIELD_NAME = 'requirementRules'
      const RULES_FIELD_NAME = 'rules'

      const WIN32_LOB_APP_VALUE = {
        [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'win32LobApp',
        displayName: 'test win32 lob app',
      }

      const BASIC_RULE = {
        [ODATA_TYPE_FIELD]: '#microsoft.graph.win32LobApp',
        enforceSignatureCheck: false,
        runAs32Bit: false,
      }
      const RULE_WITH_SCRIPT_CONTENT = {
        ...BASIC_RULE,
        [SCRIPT_CONTENT_FIELD_NAME]: 'ZWNobyAiSGVsbG8sIFdvcmxkISI=',
      }

      describe('when no rule field is present', () => {
        it('should return the value as is', async () => {
          const value = WIN32_LOB_APP_VALUE
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })

      describe('when all the rule fields are empty', () => {
        it('should return the value as is', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [],
            [REQUIREMENT_RULES_FIELD_NAME]: [],
            [RULES_FIELD_NAME]: [],
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })

      describe('when the rule fields contain rules without script content', () => {
        it('should return the value as is', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [BASIC_RULE],
            [REQUIREMENT_RULES_FIELD_NAME]: [BASIC_RULE],
            [RULES_FIELD_NAME]: [BASIC_RULE],
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })

      describe('when the rule fields contain rules with script content', () => {
        it('should return the value with the script content extracted to a static file', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [_.clone(RULE_WITH_SCRIPT_CONTENT)],
            [REQUIREMENT_RULES_FIELD_NAME]: [_.clone(RULE_WITH_SCRIPT_CONTENT)],
            [RULES_FIELD_NAME]: [_.clone(RULE_WITH_SCRIPT_CONTENT)],
          }
          const result = await application.setApplicationScriptValueAsStaticFile({
            value: _.clone(value),
            typeName: 'testApplication',
            context: { ...contextMock, fragments: [] },
          })
          expect(result.value).toEqual({
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [{ ...BASIC_RULE, [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile) }],
            [REQUIREMENT_RULES_FIELD_NAME]: [{ ...BASIC_RULE, [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile) }],
            [RULES_FIELD_NAME]: [{ ...BASIC_RULE, [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile) }],
          })
        })

        it('should use the displayName in the static file name if exists, otherwise use the rule index', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [_.clone(RULE_WITH_SCRIPT_CONTENT)],
            [REQUIREMENT_RULES_FIELD_NAME]: [
              {
                ...RULE_WITH_SCRIPT_CONTENT,
                displayName: 'test detection rule',
              },
            ],
          }
          const result = await application.setApplicationScriptValueAsStaticFile({
            value: _.clone(value),
            typeName: 'testApplication',
            context: { ...contextMock, fragments: [] },
          })
          expect(result.value).toEqual({
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [
              {
                ...BASIC_RULE,
                [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile),
              },
            ],
            [REQUIREMENT_RULES_FIELD_NAME]: [
              {
                ...BASIC_RULE,
                displayName: 'test detection rule',
                [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile),
              },
            ],
          })
          expect(result.value[DETECTION_RULES_FIELD_NAME][0][SCRIPT_CONTENT_FIELD_NAME].filepath).toEqual(
            'microsoft_security/IntuneApplication/win32LobApp/test_win32_lob_app.s/detectionRules_0.ps1',
          )
          expect(result.value[REQUIREMENT_RULES_FIELD_NAME][0][SCRIPT_CONTENT_FIELD_NAME].filepath).toEqual(
            'microsoft_security/IntuneApplication/win32LobApp/test_win32_lob_app.s/requirementRules_test_detection_rule.uss.ps1',
          )
        })

        it('should throw an error when the rule fields are not arrays', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: RULE_WITH_SCRIPT_CONTENT,
            [REQUIREMENT_RULES_FIELD_NAME]: RULE_WITH_SCRIPT_CONTENT,
            [RULES_FIELD_NAME]: RULE_WITH_SCRIPT_CONTENT,
          }
          await expect(
            application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).rejects.toThrow(
            new Error(
              'Expected IntuneApplication.detectionRules to be an array, but got {\n' +
                "  '@odata.type': '#microsoft.graph.win32LobApp',\n" +
                '  enforceSignatureCheck: false,\n' +
                '  runAs32Bit: false,\n' +
                "  scriptContent: 'ZWNobyAiSGVsbG8sIFdvcmxkISI='\n" +
                '}',
            ),
          )
        })

        it('should return the value as is when the script content is not a string', async () => {
          const value = {
            ...WIN32_LOB_APP_VALUE,
            [DETECTION_RULES_FIELD_NAME]: [{ ...BASIC_RULE, [SCRIPT_CONTENT_FIELD_NAME]: 5 }],
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })
    })

    describe('macOSPkgApp', () => {
      const PRE_INSTALL_SCRIPT_FIELD_NAME = 'preInstallScript'
      const POST_INSTALL_SCRIPT_FIELD_NAME = 'postInstallScript'

      describe('when no script field is present', () => {
        it('should return the value as is', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })

      describe('when all the script fields are empty', () => {
        it('should return the value as is', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: {},
            [POST_INSTALL_SCRIPT_FIELD_NAME]: {},
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })

      describe('when the script fields contain scripts with script content', () => {
        it('should return the value with the script content extracted to a static file', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: 'ZWNobyAiSGVsbG8sIFdvcmxkISI=',
            },
            [POST_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: 'ZWNobyAiSGVsbG8sIFdvcmxkISI=',
            },
          }
          const result = await application.setApplicationScriptValueAsStaticFile({
            value: _.clone(value),
            typeName: 'testApplication',
            context: { ...contextMock, fragments: [] },
          })
          expect(result.value).toEqual({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile),
            },
            [POST_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: expect.any(StaticFile),
            },
          })
        })

        it('should use the script field name in the static file name', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: 'ZWNobyAiSGVsbG8sIFdvcmxkISI=',
            },
            [POST_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: 'ZWNobyAiSGVsbG8sIFdvcmxkISI=',
            },
          }
          const result = await application.setApplicationScriptValueAsStaticFile({
            value: _.clone(value),
            typeName: 'testApplication',
            context: { ...contextMock, fragments: [] },
          })
          expect(result.value[PRE_INSTALL_SCRIPT_FIELD_NAME][SCRIPT_CONTENT_FIELD_NAME].filepath).toEqual(
            'microsoft_security/IntuneApplication/macOSPkgApp/test_mac_os_pkg_app.s/preInstallScript.sh',
          )
          expect(result.value[POST_INSTALL_SCRIPT_FIELD_NAME][SCRIPT_CONTENT_FIELD_NAME].filepath).toEqual(
            'microsoft_security/IntuneApplication/macOSPkgApp/test_mac_os_pkg_app.s/postInstallScript.sh',
          )
        })

        it('should throw an error when the script field is not an object', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: 'not an object',
          }
          await expect(
            application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).rejects.toThrow("Expected IntuneApplication.preInstallScript to be a plain object, but got 'not an object'")
        })

        it('should return the value as is when the script content is not a string', async () => {
          const value = {
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'macOSPkgApp',
            displayName: 'test mac os pkg app',
            [PRE_INSTALL_SCRIPT_FIELD_NAME]: {
              [SCRIPT_CONTENT_FIELD_NAME]: 5,
            },
          }
          expect(
            await application.setApplicationScriptValueAsStaticFile({
              value,
              typeName: 'testApplication',
              context: { ...contextMock, fragments: [] },
            }),
          ).toEqual({ value })
        })
      })
    })
  })
})
