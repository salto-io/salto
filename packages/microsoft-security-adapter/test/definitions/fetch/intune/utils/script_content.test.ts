/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validateArray } from '@salto-io/adapter-utils'
import { StaticFile } from '@salto-io/adapter-api'
import {
  ExtractScriptParams,
  extractStaticFileFromBinaryScript,
} from '../../../../../src/definitions/fetch/intune/utils/script_content'
import { NAME_ID_FIELD } from '../../../../../src/definitions/fetch/shared/defaults'
import { validateStaticFile } from '../../../../utils'

describe('Script content utils', () => {
  describe(extractStaticFileFromBinaryScript.name, () => {
    const VALUE = {
      [NAME_ID_FIELD.fieldName]: 'test',
      otherNameField: 'different',
      testScriptsRoot: [
        {
          path: { to: { script: 'PG5vdGU+VGhpcyBpcyBhIHRlc3Q8L25vdGU+', someRandomValue: 'test1' } },
          otherValue: 'test1',
        },
        {
          path: { to: { script: 'VGhpcyBpcyBhIHRlc3Q8L25vdGU+', someRandomValue: 'test2' } },
          otherValue: 'test2',
        },
      ],
    }

    const PARAMS_WITHOUT_VALUE: Omit<ExtractScriptParams, 'value'> = {
      typeName: 'testType',
      scriptsRootFieldName: 'testScriptsRoot',
      scriptValuePath: ['path', 'to', 'script'],
      toFileName: ({ scriptsRootFieldName, scriptField }) => `${scriptsRootFieldName}_${scriptField.otherValue}`,
      validateFunc: scriptRootFieldValue => {
        validateArray(scriptRootFieldValue, 'testType')
        if (scriptRootFieldValue.length === 0) {
          throw new Error('No scripts found')
        }
      },
    }

    describe('when the value is valid', () => {
      it('should extract the scripts to static files', async () => {
        const clonedValue = _.cloneDeep(VALUE)
        extractStaticFileFromBinaryScript({
          ...PARAMS_WITHOUT_VALUE,
          value: clonedValue,
        })
        expect(clonedValue).toEqual({
          ...VALUE,
          testScriptsRoot: [
            {
              path: {
                to: {
                  script: expect.any(StaticFile),
                  someRandomValue: 'test1',
                },
              },
              otherValue: 'test1',
            },
            {
              path: {
                to: {
                  script: expect.any(StaticFile),
                  someRandomValue: 'test2',
                },
              },
              otherValue: 'test2',
            },
          ],
        })

        await validateStaticFile({
          value: clonedValue.testScriptsRoot[0].path.to.script,
          expectedContent: '<note>This is a test</note>',
          expectedPath: 'microsoft_security/testType/test/testScriptsRoot_test1',
        })
        await validateStaticFile({
          value: clonedValue.testScriptsRoot[1].path.to.script,
          expectedContent: 'This is a test</note>',
          expectedPath: 'microsoft_security/testType/test/testScriptsRoot_test2',
        })
      })

      it('should update the path when providing elemIDFieldName', async () => {
        const clonedValue = _.cloneDeep(VALUE)
        extractStaticFileFromBinaryScript({
          ...PARAMS_WITHOUT_VALUE,
          value: clonedValue,
          elemIDFieldName: 'otherNameField',
        })

        await validateStaticFile({
          value: clonedValue.testScriptsRoot[0].path.to.script,
          expectedContent: '<note>This is a test</note>',
          expectedPath: 'microsoft_security/testType/different/testScriptsRoot_test1',
        })
        await validateStaticFile({
          value: clonedValue.testScriptsRoot[1].path.to.script,
          expectedContent: 'This is a test</note>',
          expectedPath: 'microsoft_security/testType/different/testScriptsRoot_test2',
        })
      })

      it('should update the path when providing staticFileSubDirectory', async () => {
        const clonedValue = _.cloneDeep(VALUE)
        extractStaticFileFromBinaryScript({
          ...PARAMS_WITHOUT_VALUE,
          value: clonedValue,
          staticFileSubDirectory: 'subdir',
        })

        await validateStaticFile({
          value: clonedValue.testScriptsRoot[0].path.to.script,
          expectedContent: '<note>This is a test</note>',
          expectedPath: 'microsoft_security/testType/subdir/test/testScriptsRoot_test1',
        })
        await validateStaticFile({
          value: clonedValue.testScriptsRoot[1].path.to.script,
          expectedContent: 'This is a test</note>',
          expectedPath: 'microsoft_security/testType/subdir/test/testScriptsRoot_test2',
        })
      })
    })

    describe('when the rootField is empty', () => {
      it('should return the value as is', () => {
        const clonedValue = _.cloneDeep(VALUE)
        expect(
          extractStaticFileFromBinaryScript({
            ...PARAMS_WITHOUT_VALUE,
            value: { ...clonedValue, testScriptsRoot: [] },
          }),
        ).toEqual({ value: { ...clonedValue, testScriptsRoot: [] } })
      })
    })

    describe('when the value is in bad format', () => {
      it('should throw when the validation function throws', () => {
        expect(() =>
          extractStaticFileFromBinaryScript({
            ...PARAMS_WITHOUT_VALUE,
            value: _.cloneDeep(VALUE),
            validateFunc: () => {
              throw new Error('validation error')
            },
          }),
        ).toThrow('validation error')
      })

      it('should return the value as is when the script content is not a string', () => {
        const value = {
          testScriptsRoot: [
            {
              path: { to: { script: 1 } },
              otherValue: 'test1',
            },
          ],
        }
        expect(
          extractStaticFileFromBinaryScript({
            ...PARAMS_WITHOUT_VALUE,
            value,
          }),
        ).toEqual({ value })
      })
    })
  })
})
