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
  describe(`${applicationConfiguration.decodePayloadJsonField.name}`, () => {
    describe('when the value is a valid base64 encoded json', () => {
      it('should return an adjust function that decodes the requested binary fields', async () => {
        expect(
          await applicationConfiguration.decodePayloadJsonField({
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

    describe('when the value is not a string', () => {
      it('should return the original value', async () => {
        expect(
          await applicationConfiguration.decodePayloadJsonField({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 1,
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { [PAYLOAD_JSON_FIELD_NAME]: 1, someOtherField: 'not encoded' },
        })
      })
    })

    describe('when the value is not a valid base64 encoded json', () => {
      it('should return the original value', async () => {
        expect(
          await applicationConfiguration.decodePayloadJsonField({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 'a',
              someOtherField: 'b',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { [PAYLOAD_JSON_FIELD_NAME]: 'a', someOtherField: 'b' },
        })
      })
    })
  })

  describe(`${applicationConfiguration.encodePayloadJsonField.name}`, () => {
    describe('when the value is a valid json', () => {
      it('should return an adjust function that encodes the requested binary fields', async () => {
        expect(
          await applicationConfiguration.encodePayloadJsonField({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: { a: 'a', b: 'b' },
              someOtherField: { c: 'd', e: 'f' },
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: {
            [PAYLOAD_JSON_FIELD_NAME]: 'eyJhIjoiYSIsImIiOiJiIn0=',
            someOtherField: { c: 'd', e: 'f' },
          },
        })
      })
    })

    describe('when the value is not a valid json', () => {
      it('should return the original value', async () => {
        expect(
          await applicationConfiguration.encodePayloadJsonField({
            value: {
              [PAYLOAD_JSON_FIELD_NAME]: 'a',
              someOtherField: 'b',
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: { [PAYLOAD_JSON_FIELD_NAME]: 'a', someOtherField: 'b' },
        })
      })
    })
  })

  describe(`${applicationConfiguration.parseSettingXmlField.name}`, () => {
    describe('when the value is a valid base64 encoded xml', () => {
      it('should return an adjust function that decodes the requested binary xml fields', async () => {
        expect(
          await applicationConfiguration.parseSettingXmlField({
            value: {
              [ENCODED_SETTING_XML_FIELD_NAME]: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
              someOtherField: 'not encoded',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            [ENCODED_SETTING_XML_FIELD_NAME]: {
              root: {
                child: 'contentA',
              },
            },
            someOtherField: 'not encoded',
          },
        })
      })
    })

    describe('when the value is not a valid base64 encoded xml', () => {
      it('should return the original value', async () => {
        expect(
          await applicationConfiguration.parseSettingXmlField({
            value: {
              [ENCODED_SETTING_XML_FIELD_NAME]: 'PGhlYWQ/',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { [ENCODED_SETTING_XML_FIELD_NAME]: 'PGhlYWQ/' },
        })
      })
    })
  })

  describe(`${applicationConfiguration.buildSettingXmlField.name}`, () => {
    describe('when the value is a valid xml', () => {
      it('should return an adjust function that encodes the requested binary xml fields', async () => {
        expect(
          await applicationConfiguration.buildSettingXmlField({
            value: {
              [ENCODED_SETTING_XML_FIELD_NAME]: {
                root: {
                  child: 'contentA',
                },
              },
              someOtherValue: {
                root: {
                  child: 'contentB',
                },
              },
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: {
            [ENCODED_SETTING_XML_FIELD_NAME]: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
            someOtherValue: {
              root: {
                child: 'contentB',
              },
            },
          },
        })
      })
    })

    describe('when the value is not a valid xml', () => {
      it('should return the original value', async () => {
        expect(
          await applicationConfiguration.buildSettingXmlField({
            value: {
              [ENCODED_SETTING_XML_FIELD_NAME]: 'a',
              someOtherValue: 'b',
            },
            typeName: 'test',
            context: contextMock,
          }),
        ).toEqual({
          value: { [ENCODED_SETTING_XML_FIELD_NAME]: 'a', someOtherValue: 'b' },
        })
      })
    })
  })
})
