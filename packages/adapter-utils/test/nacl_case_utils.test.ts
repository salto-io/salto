/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  fileNameFromNaclCase,
  fileNameFromUniqueName,
  invertNaclCase,
  naclCase,
  normalizeFilePathPart,
  pathNaclCase,
  prettifyName,
} from '../src/nacl_case_utils'

describe('naclCase utils', () => {
  const generateRandomChar = (): string => String.fromCharCode(Math.random() * 65535)

  describe(`${naclCase.name} func`, () => {
    it('should return empty string for undefined', () => {
      expect(naclCase(undefined)).toEqual('')
    })

    describe('No special chars', () => {
      const noSpecialChars = ['name', 'nameWithNumber4']
      it('Should remain the same', () => {
        noSpecialChars.forEach(name => expect(naclCase(name)).toEqual(name))
      })
    })

    describe('When all special chars are _', () => {
      const specialCharOnlyUnderscore = ['a_b_c_d', 'Lala__Lead__c']
      it('Should remain the same', () => {
        specialCharOnlyUnderscore.forEach(name => expect(naclCase(name)).toEqual(name))
      })
    })

    describe('When all characters are digits', () => {
      const digitOnly = ['1231', '0000', '0123', '6547587474574']
      it('Should append the escaping separator', () => {
        digitOnly.forEach(name => expect(naclCase(name)).toEqual(`${name}@`))
      })
    })
    describe('When the value is numeric but not all characters are digits', () => {
      it('Should use regular escaping', () => {
        expect(naclCase('-1')).toEqual('_1@b')
        expect(naclCase('+1')).toEqual('_1@ze')
        expect(naclCase('23a')).toEqual('23a')
        expect(naclCase('2-3')).toEqual('2_3@b')
        expect(naclCase('4.5')).toEqual('4_5@v')
      })
    })

    describe('When all special chars are same and "mapped"', () => {
      it('Should replace special with _, add separator and mapped val once', () => {
        expect(naclCase('Name Special Char')).toEqual('Name_Special_Char@s')
        expect(naclCase('Name@Special@Char')).toEqual('Name_Special_Char@m')
        expect(naclCase('Name$Special$Char')).toEqual('Name_Special_Char@zc')
        expect(naclCase('Name-Special-Char')).toEqual('Name_Special_Char@b')
      })
    })

    describe('When there are different special chars', () => {
      it('Should replace special with _, add separator and add mapping', () => {
        expect(naclCase('Name Special@Char')).toEqual('Name_Special_Char@sm')
        expect(naclCase('Name@Special_Char')).toEqual('Name_Special_Char@mu')
        expect(naclCase('NameאSpecial Char')).toEqual('Name_Special_Char@_01488s')
      })
    })

    describe('When two strings have special chars', () => {
      const numberOfRandomChecks = 100
      it('Should have different values after naclCase if diff chars', () => {
        expect(naclCase('Name Special Char')).not.toEqual(naclCase('Name Special_Char'))
        expect(naclCase('Name_Special__Char')).not.toEqual(naclCase('Name_Special_Char'))
        _.times(numberOfRandomChecks, () => {
          const charA = generateRandomChar()
          const charB = generateRandomChar()
          if (charA === charB) {
            return
          }
          const nameWithCharA = `Name${charA}Special${charA}Char`
          const nameWithCharB = `Name${charB}Special${charB}Char`
          expect(naclCase(nameWithCharA)).not.toEqual(naclCase(nameWithCharB))
        })
      })
    })
  })
  describe(`${invertNaclCase.name} func`, () => {
    it('should return empty string for undefined', () => {
      expect(invertNaclCase('')).toEqual('')
    })
    it('should return string if not a naclCase', () => {
      expect(invertNaclCase('name')).toEqual('name')
    })
    it('should return decoded value for single default mappings', () => {
      expect(invertNaclCase('name_@a')).toEqual('name?')
    })
    it('should return decoded value for double default mappings', () => {
      expect(invertNaclCase('name_@za')).toEqual('name`')
    })
    it('should return decoded value for custom mappings', () => {
      expect(invertNaclCase('name_@_00229')).toEqual('nameå')
    })
    it('should return decoded value for mixed mappings', () => {
      expect(invertNaclCase('_a_b_c_d_e_f@_00229abcd_00230')).toEqual('åa?b-c\\d/eæf')
    })
    it('should return string if encoded suffix is empty', () => {
      expect(invertNaclCase('name_@')).toEqual('name_')
    })
    it('should re-use encoded suffix for all replacements if it is only 1 char', () => {
      expect(invertNaclCase('name____@a')).toEqual('name????')
    })
  })

  describe(`${pathNaclCase.name} func`, () => {
    describe('Without naclCase separator', () => {
      const noSeparatorNames = ['lalala', 'Lead', 'LALA__Lead__c', 'NameWithNumber2']
      it('Should remain the same', () => {
        noSeparatorNames.forEach(name => expect(pathNaclCase(name)).toEqual(name))
      })
    })

    describe('With naclCase separator', () => {
      it('Should return up to the separator', () => {
        expect(pathNaclCase('Lead@1234')).toEqual('Lead')
        expect(pathNaclCase('LALA__Lead__c@12_34')).toEqual('LALA__Lead__c')
        expect(pathNaclCase('NameWithNumber2@12_34')).toEqual('NameWithNumber2')
        expect(pathNaclCase('0123@')).toEqual('0123')
      })
    })

    describe('With a very long string', () => {
      const longString = new Array(30).fill('123456789_').join('')
      it('Should return at most 200 chars', () => {
        expect(pathNaclCase(longString).length).toBeLessThanOrEqual(200)
      })

      it('Should return the first 200 chars', () => {
        expect(pathNaclCase(longString)).toEqual(longString.slice(0, 200))
      })
    })
  })

  describe(`${normalizeFilePathPart.name} func`, () => {
    describe('With a short path', () => {
      const shortPaths = ['lalala.txt', 'aבגדe.טקסט', 'noExtension']
      it('Should remain the same', () => {
        shortPaths.forEach(path => expect(normalizeFilePathPart(path)).toEqual(path))
      })
    })
    describe('With a very long path', () => {
      const longPathPrefix = new Array(17).fill('123456שבע0_').join('')
      const extension = '.extension'
      const longString = longPathPrefix.concat(extension)
      const anotherLongString = longPathPrefix.concat('a').concat(extension)
      it('Should return at exactly 200 chars or less', () => {
        expect(Buffer.from(normalizeFilePathPart(longString)).byteLength).toBeLessThanOrEqual(200)
      })
      it('Should contain the full file extension', () => {
        expect(normalizeFilePathPart(longString)).toContain(extension)
      })
      it('Should maintain difference between different strings', () => {
        expect(normalizeFilePathPart(longString)).not.toEqual(normalizeFilePathPart(anotherLongString))
      })
    })
    describe('With a very long extension', () => {
      const extension = new Array(17).fill('1234חמש890_').join('')
      const longString = 'aaa.'.concat(extension)
      it('Should return 200 chars or less', () => {
        expect(Buffer.from(normalizeFilePathPart(longString)).byteLength).toBeLessThanOrEqual(200)
      })
      it('Should not contain the full file extension', () => {
        expect(normalizeFilePathPart(longString)).not.toContain(extension)
      })
    })
    describe('With a short non ascii extension', () => {
      const extension = '.סיומת'
      const longString = new Array(17).fill('1234חמש890_').join('').concat(extension)
      it('Should return 200 chars or less', () => {
        expect(Buffer.from(normalizeFilePathPart(longString)).byteLength).toBeLessThanOrEqual(200)
      })
      it('Should not contain the full file extension', () => {
        expect(normalizeFilePathPart(longString)).not.toContain(extension)
      })
    })
  })

  describe(`${fileNameFromNaclCase.name} func`, () => {
    it('should return empty string for empty input', () => {
      expect(fileNameFromNaclCase('')).toEqual('')
    })
    it('should replace @ with . at the end of the input', () => {
      expect(fileNameFromNaclCase('name@')).toEqual('name.')
    })
    it('should replace @ with . in the middle of the input', () => {
      expect(fileNameFromNaclCase('name@name')).toEqual('name.name')
    })
  })

  describe(`${fileNameFromUniqueName.name} func`, () => {
    it('should return empty string for empty input', () => {
      expect(fileNameFromUniqueName('')).toEqual('')
    })
    it('should convert the input to nacl case and replace @ with . at the end', () => {
      expect(fileNameFromUniqueName('Name Special Char')).toEqual('Name_Special_Char.s')
    })
  })

  describe(`${prettifyName.name} func`, () => {
    it('should return if there is a space', () => {
      expect(prettifyName('prettify_camelCase_text@su')).toEqual('prettify camelCase_text')
    })
    it('should handle only numbers correctly', () => {
      expect(prettifyName('1222@')).toEqual('1222')
    })
    it('should handle numbers and letters correctly', () => {
      expect(prettifyName('126_bla22bla__as2@szcs')).toEqual('126 bla22bla$ as2')
    })
    it('should split by space camelCase', () => {
      expect(prettifyName('camelCase')).toEqual('Camel Case')
    })
    it('should split by space camelCase and _', () => {
      expect(prettifyName('camelCase_a')).toEqual('Camel Case A')
    })
    it('should do nothing for capital only', () => {
      expect(prettifyName('ABCDE')).toEqual('ABCDE')
    })
    it('should handel splitting two words one is all capitalized', () => {
      expect(prettifyName('NAMEName')).toEqual('NAME Name')
    })
  })
})
