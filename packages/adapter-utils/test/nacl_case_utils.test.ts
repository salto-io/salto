/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { hash as hashUtils } from '@salto-io/lowerdash'
import { invertNaclCase, naclCase, normalizeStaticResourcePath, pathNaclCase } from '../src/nacl_case_utils'

describe('naclCase utils', () => {
  const generateRandomChar = (): string =>
    (String.fromCharCode((Math.random() * 65535)))

  describe('naclCase func', () => {
    it('should return empty string for undefined', () => {
      expect(naclCase(undefined)).toEqual('')
    })

    describe('No special chars', () => {
      const noSpecialChars = [
        'name', 'nameWithNumber4',
      ]
      it('Should remain the same', () => {
        noSpecialChars.forEach(name => expect(naclCase(name)).toEqual(name))
      })
    })

    describe('When all special chars are _', () => {
      const specialCharOnlyUnderscore = [
        'a_b_c_d', 'Lala__Lead__c',
      ]
      it('Should remain the same', () => {
        specialCharOnlyUnderscore.forEach(name => expect(naclCase(name)).toEqual(name))
      })
    })

    describe('When all characters are digits', () => {
      const digitOnly = [
        '1231', '0000', '0123', '6547587474574',
      ]
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
      it('Should replace special with _, add seperator and mapped val once', () => {
        expect(naclCase('Name Special Char')).toEqual('Name_Special_Char@s')
        expect(naclCase('Name@Special@Char')).toEqual('Name_Special_Char@m')
        expect(naclCase('Name$Special$Char')).toEqual('Name_Special_Char@zc')
        expect(naclCase('Name-Special-Char')).toEqual('Name_Special_Char@b')
      })
    })

    describe('When there are different special chars', () => {
      it('Should replace special with _, add seperator and add mapping', () => {
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
  describe('invertNaclCase func', () => {
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

  describe('pathNaclCase func', () => {
    describe('Without naclCase separator', () => {
      const noSeparatorNames = [
        'lalala', 'Lead', 'LALA__Lead__c', 'NameWithNumber2',
      ]
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

  describe('normalizeStaticResourcePath func', () => {
    describe('With a short path', () => {
      const shortPaths = [
        'lalala.txt', 'aבגדe.טקסט', 'noExtention',
      ]
      it('Should remain the same', () => {
        shortPaths.forEach(path => expect(normalizeStaticResourcePath(path)).toEqual(path))
      })
    })
    describe('With a very long path', () => {
      const longString = new Array(30).fill('123456שבע0_').join('').concat('.extension')
      const longStringHash = hashUtils.toMD5(longString)
      it('Should return at extacly 200 chars', () => {
        expect(Buffer.from(normalizeStaticResourcePath(longString)).byteLength).toEqual(200)
      })

      it('Should return the first 200 chars, hash and the extension', () => {
        const addedSuffix = `_${longStringHash}.extension`
        expect(normalizeStaticResourcePath(longString))
          .toEqual(longString.slice(0, 200 - addedSuffix.length).concat(addedSuffix))
      })
    })
    describe('With a very long extension', () => {
      const longString = 'aaa.'.concat(new Array(30).fill('1234חמש890_').join(''))
      const longStringHash = hashUtils.toMD5(longString)
      it('Should return exactly 200 chars', () => {
        expect(Buffer.from(normalizeStaticResourcePath(longString)).byteLength).toEqual(200)
      })

      it('Should return the first 200 chars and hash', () => {
        const addedSuffix = `_${longStringHash}`
        expect(normalizeStaticResourcePath(longString))
          .toEqual(longString.slice(0, 200 - addedSuffix.length).concat(addedSuffix))
      })
    })
  })
})
