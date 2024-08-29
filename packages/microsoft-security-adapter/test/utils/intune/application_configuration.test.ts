/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { intuneConstants } from '../../../src/constants'
import { applicationConfiguration } from '../../../src/utils/intune'
import { contextMock } from '../../mocks'

const { PAYLOAD_JSON_FIELD_NAME, ENCODED_SETTING_XML_FIELD_NAME } = intuneConstants

describe('Application configuration utils', () => {
  describe(`${applicationConfiguration.parseApplicationConfigurationBinaryFields.name}`, () => {
    describe('when the operation is fetch', () => {
      it('should return an adjust function that decodes the binary fields', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('fetch')({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 'eyJhIjoiYSIsImIiOiJiIn0=',
              [ENCODED_SETTING_XML_FIELD_NAME]: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: { a: 'a', b: 'b' },
            [ENCODED_SETTING_XML_FIELD_NAME]: {
              root: {
                child: 'contentA',
              },
            },
            someOtherField: 'not encoded',
          },
        })
      })

      it('should return the original value if the binary fields are not valid', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('fetch')({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 1,
              [ENCODED_SETTING_XML_FIELD_NAME]: 'PGhlYWQ/',
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: 1,
            [ENCODED_SETTING_XML_FIELD_NAME]: 'PGhlYWQ/',
            someOtherField: 'not encoded',
          },
        })
      })

      it('should ignore missing binary fields', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('fetch')({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 'eyJhIjoiYSIsImIiOiJiIn0=',
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: { a: 'a', b: 'b' },
            someOtherField: 'not encoded',
          },
        })
      })
    })

    describe('when the operation is deploy', () => {
      it('should return an adjust function that encodes the binary fields', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('deploy')({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: { a: 'a', b: 'b' },
              [ENCODED_SETTING_XML_FIELD_NAME]: {
                root: {
                  child: 'contentA',
                },
              },
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: 'eyJhIjoiYSIsImIiOiJiIn0=',
            [ENCODED_SETTING_XML_FIELD_NAME]: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
            someOtherField: 'not encoded',
          },
        })
      })

      it('should return the original value if the fields are not objects', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('deploy')({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 1,
              [ENCODED_SETTING_XML_FIELD_NAME]: 'not an object',
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: 1,
            [ENCODED_SETTING_XML_FIELD_NAME]: 'not an object',
            someOtherField: 'not encoded',
          },
        })
      })

      it('should ignore missing fields', async () => {
        expect(
          await applicationConfiguration.parseApplicationConfigurationBinaryFields('deploy')({
            value: {
              [ENCODED_SETTING_XML_FIELD_NAME]: {
                root: {
                  child: 'contentA',
                },
              },
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: {
            [ENCODED_SETTING_XML_FIELD_NAME]: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
            someOtherField: 'not encoded',
          },
        })
      })
    })
  })
})
