/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { parser } from '../../../src/utils'

describe('Parser utils', () => {
  describe(`${parser.decodeBase64JsonFields.name}`, () => {
    describe('when the value is a valid base64 encoded json', () => {
      it('should return an adjust function that decodes the requested binary fields', async () => {
        const adjust = parser.decodeBase64JsonFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'eyJhIjoiYSIsImIiOiJiIn0=',
              b: 'eyJjIjoiZCIsImUiOiJmIn0=',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { a: { a: 'a', b: 'b' }, b: { c: 'd', e: 'f' } },
        })
      })
    })

    describe('when the value is not a valid base64 encoded json', () => {
      it('should return the original value', async () => {
        const adjust = parser.decodeBase64JsonFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'a',
              b: 'b',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { a: 'a', b: 'b' },
        })
      })
    })
  })

  describe(`${parser.encodeBase64JsonFields.name}`, () => {
    describe('when the value is a valid json', () => {
      it('should return an adjust function that encodes the requested binary fields', async () => {
        const adjust = parser.encodeBase64JsonFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: { a: 'a', b: 'b' },
              b: { c: 'd', e: 'f' },
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            a: 'eyJhIjoiYSIsImIiOiJiIn0=',
            b: 'eyJjIjoiZCIsImUiOiJmIn0=',
          },
        })
      })
    })

    describe('when the value is not a valid json', () => {
      it('should return the original value', async () => {
        const adjust = parser.encodeBase64JsonFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'a',
              b: 'b',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { a: 'a', b: 'b' },
        })
      })
    })
  })

  describe(`${parser.parseBase64XmlFields.name}`, () => {
    describe('when the value is a valid base64 encoded xml', () => {
      it('should return an adjust function that decodes the requested binary xml fields', async () => {
        const adjust = parser.parseBase64XmlFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
              b: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRCPC9jaGlsZD48L3Jvb3Q+',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            a: {
              root: {
                child: 'contentA',
              },
            },
            b: {
              root: {
                child: 'contentB',
              },
            },
          },
        })
      })
    })

    describe('when the value is not a valid base64 encoded xml', () => {
      it('should return the original value', async () => {
        const adjust = parser.parseBase64XmlFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'PGhlYWQ/',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { a: 'PGhlYWQ/' },
        })
      })
    })
  })

  describe(`${parser.buildBase64XmlFields.name}`, () => {
    describe('when the value is a valid xml', () => {
      it('should return an adjust function that encodes the requested binary xml fields', async () => {
        const adjust = parser.buildBase64XmlFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: {
                root: {
                  child: 'contentA',
                },
              },
              b: {
                root: {
                  child: 'contentB',
                },
              },
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: {
            a: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRBPC9jaGlsZD48L3Jvb3Q+',
            b: 'PHJvb3Q+PGNoaWxkPmNvbnRlbnRCPC9jaGlsZD48L3Jvb3Q+',
          },
        })
      })
    })

    describe('when the value is not a valid xml', () => {
      it('should return the original value', async () => {
        const adjust = parser.buildBase64XmlFields('a', 'b')
        expect(
          await adjust({
            value: {
              a: 'a',
              b: 'b',
            },
            typeName: 'test',
            context: {},
          }),
        ).toEqual({
          value: { a: 'a', b: 'b' },
        })
      })
    })
  })
})
