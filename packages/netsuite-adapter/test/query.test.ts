/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { describe } from 'jest-circus'
import { andQuery, buildNetsuiteQuery, notQuery } from '../src/query'

describe('NetsuiteQuery', () => {
  describe('buildNetsuiteQuery', () => {
    describe('valid query', () => {
      const query = buildNetsuiteQuery({
        types: {
          addressForm: ['aaa.*', 'bbb.*'],
          advancedpdftemplate: ['ccc.*', 'ddd.*'],
        },
        filePaths: ['eee.*', 'fff.*'],
      })

      describe('isTypeMatch', () => {
        it('should match the received types', () => {
          expect(query.isTypeMatch('addressForm')).toBeTruthy()
          expect(query.isTypeMatch('advancedpdftemplate')).toBeTruthy()
        })

        it('should not match types the were not received', () => {
          expect(query.isTypeMatch('wrongType')).toBeFalsy()
        })
      })

      describe('isFileMatch', () => {
        it('should match file paths that match the received regexes', () => {
          expect(query.isFileMatch('eeeaaa')).toBeTruthy()
          expect(query.isFileMatch('ffffqqqq')).toBeTruthy()
        })

        it('should not match file paths that do not match the received regexes', () => {
          expect(query.isFileMatch('aaaaa')).toBeFalsy()
        })
      })

      describe('isObjectMatch', () => {
        it('should match objects that match the received regexes', () => {
          expect(query.isObjectMatch({ scriptId: 'aaaaaa', type: 'addressForm' })).toBeTruthy()
          expect(query.isObjectMatch({ scriptId: 'cccccc', type: 'advancedpdftemplate' })).toBeTruthy()
        })

        it('should not match objects that do not match the received regexes', () => {
          expect(query.isObjectMatch({ scriptId: 'aaaaaa', type: 'notExists' })).toBeFalsy()
          expect(query.isObjectMatch({ scriptId: 'cccccc', type: 'addressForm' })).toBeFalsy()
        })
      })
    })

    describe('validateParameters', () => {
      it('Valid query should not throw exception', () => {
        expect(() => buildNetsuiteQuery({
          types: {
            addressForm: ['aaa.*', 'bbb.*'],
            advancedpdftemplate: ['ccc.*', 'ddd.*'],
          },
          filePaths: ['eee.*', 'fff.*'],
        })).not.toThrow()
      })

      it('Invalid regexes should throw an error with the regexes', () => {
        let error: Error | undefined
        try {
          buildNetsuiteQuery({
            types: {
              addressForm: ['aa(a.*', 'bbb.*'],
            },
            filePaths: ['eee.*', 'f(ff.*'],
          })
        } catch (e) {
          error = e
        }

        expect(error).toBeDefined()
        expect(error?.message).toContain('aa(a.*')
        expect(error?.message).toContain('f(ff.*')
        expect(error?.message).not.toContain('bbb.*')
        expect(error?.message).not.toContain('eee.*')
      })

      it('Invalid types should throw an error with the types', () => {
        let error: Error | undefined
        try {
          buildNetsuiteQuery({
            types: {
              addressForm: ['.*'],
              invalidType: ['.*'],
            },
          })
        } catch (e) {
          error = e
        }

        expect(error).toBeDefined()
        expect(error?.message).toContain('invalidType')
        expect(error?.message).not.toContain('addressForm')
      })
    })
  })

  describe('andQuery', () => {
    const firstQuery = buildNetsuiteQuery({
      types: {
        addressForm: ['aaa.*'],
        advancedpdftemplate: ['.*'],
      },
      filePaths: ['bbb.*'],
    })
    const secondQuery = buildNetsuiteQuery({
      types: {
        addressForm: ['.*ccc'],
        bankstatementparserplugin: ['.*'],
      },
      filePaths: ['.*ddd'],
    })
    const bothQuery = andQuery(firstQuery, secondQuery)

    it('should match only types that match both queries', () => {
      expect(bothQuery.isTypeMatch('addressForm')).toBeTruthy()
      expect(bothQuery.isTypeMatch('advancedpdftemplate')).toBeFalsy()
      expect(bothQuery.isTypeMatch('bankstatementparserplugin')).toBeFalsy()
    })

    it('should match only files that match both queries', () => {
      expect(bothQuery.isFileMatch('bbbdddd')).toBeTruthy()
      expect(bothQuery.isFileMatch('bbb')).toBeFalsy()
      expect(bothQuery.isFileMatch('ddd')).toBeFalsy()
    })

    it('should match only objects that match both queries', () => {
      expect(bothQuery.isObjectMatch({ scriptId: 'aaacccc', type: 'addressForm' })).toBeTruthy()
      expect(bothQuery.isObjectMatch({ scriptId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(bothQuery.isObjectMatch({ scriptId: 'aaa', type: 'advancedpdftemplate' })).toBeFalsy()
    })
  })

  describe('notQuery', () => {
    const query = buildNetsuiteQuery({
      types: {
        addressForm: ['aaa.*'],
      },
      filePaths: ['bbb.*'],
    })
    const inverseQuery = notQuery(query)

    it('should match only types that do not match the original query', () => {
      expect(inverseQuery.isTypeMatch('addressForm')).toBeFalsy()
      expect(inverseQuery.isTypeMatch('advancedpdftemplate')).toBeTruthy()
    })

    it('should match only files that do not match the original query', () => {
      expect(inverseQuery.isFileMatch('bbb')).toBeFalsy()
      expect(inverseQuery.isFileMatch('ddd')).toBeTruthy()
    })

    it('should match only objects that do not match the original query', () => {
      expect(inverseQuery.isObjectMatch({ scriptId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(inverseQuery.isObjectMatch({ scriptId: 'aaa', type: 'advancedpdftemplate' })).toBeTruthy()
      expect(inverseQuery.isObjectMatch({ scriptId: 'bbb', type: 'addressForm' })).toBeTruthy()
    })
  })
})
