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
import { andQuery, buildNetsuiteQuery, notQuery, validateFetchParameters, convertToQueryParams, FetchTypeQueryParams } from '../src/query'

describe('NetsuiteQuery', () => {
  describe('buildNetsuiteQuery', () => {
    describe('valid query', () => {
      const query = buildNetsuiteQuery({
        types: [
          { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
          { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
          { name: 'Account', ids: ['.*'] },
          { name: 'Account', ids: ['.*'] },
        ],
        fileCabinet: ['eee.*', 'fff.*'],
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
          expect(query.isObjectMatch({ instanceId: 'aaaaaa', type: 'addressForm' })).toBeTruthy()
          expect(query.isObjectMatch({ instanceId: 'cccccc', type: 'advancedpdftemplate' })).toBeTruthy()
        })

        it('should not match objects that do not match the received regexes', () => {
          expect(query.isObjectMatch({ instanceId: 'aaaaaa', type: 'notExists' })).toBeFalsy()
          expect(query.isObjectMatch({ instanceId: 'cccccc', type: 'addressForm' })).toBeFalsy()
        })
      })

      describe('areSomeFilesMatch', () => {
        it('when has files match should return true', () => {
          expect(query.areSomeFilesMatch()).toBeTruthy()
        })

        it('when does not` has files match should return false', () => {
          const q = buildNetsuiteQuery({
            types: [
              { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
              { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
            ],
            fileCabinet: [],
          })
          expect(q.areSomeFilesMatch()).toBeFalsy()
        })
      })
      describe('areAllObjectsMatch', () => {
        it('when there is .* should return true', () => {
          expect(query.areAllObjectsMatch('Account')).toBeTruthy()
          expect(query.areAllObjectsMatch('addressForm')).toBeFalsy()
        })
      })
      describe('validQueryWithOldFormat', () => {
        const queryOldFormat = buildNetsuiteQuery(convertToQueryParams({
          types: {
            addressForm: ['aaa.*', 'bbb.*'],
          },
          filePaths: ['eee.*', 'fff.*'],
        }))
        it('should match the received types from (old format)', () => {
          expect(queryOldFormat.isTypeMatch('addressForm')).toBeTruthy()
        })
        it('should not match types that were not received (old format)', () => {
          expect(queryOldFormat.isTypeMatch('wrongType')).toBeFalsy()
        })
        it('should match file paths that match the received regexes (old format)', () => {
          expect(queryOldFormat.isFileMatch('eeeaaa')).toBeTruthy()
          expect(queryOldFormat.isFileMatch('ffffqqqq')).toBeTruthy()
        })
      })
    })
  })

  describe('validateParameters', () => {
    it('Valid query should not throw exception', () => {
      expect(() => validateFetchParameters({
        types: [
          { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
          { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
        ],
        fileCabinet: ['eee.*', 'fff.*'],
      })).not.toThrow()
    })

    it('Invalid regexes should throw an error with the regexes', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [
            { name: 'addressForm', ids: ['aa(a.*', 'bbb.*'] },
          ],
          fileCabinet: ['eee.*', 'f(ff.*'],
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

    it('should throw an error when type has invalid "name" reg expression', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [{
            name: 'aa(a.*',
          }],
          fileCabinet: [],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('aa(a.*')
      expect(error?.message).toContain('The following regular expressions are invalid')
    })
    it('should throw an error when type has undefined "name"', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [{
            name: 'aa',
          },
          {} as unknown as FetchTypeQueryParams],
          fileCabinet: [],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('received invalid adapter config input. Expected type name to be a string, but found:')
    })
    it('should throw an error when fileCabinet is undefined', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [{
            name: 'aaa',
          }],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('received invalid adapter config input. "fileCabinet" field is expected to be an array')
    })
    it('should throw an error when types is undefined', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          fileCabinet: [],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('received invalid adapter config input. "types" field is expected to be an array')
    })
    it('should throw an error when types has invalid ids field', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [{
            name: 'aaa',
            ids: ['string', 1],
          } as unknown as FetchTypeQueryParams],
          fileCabinet: [],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('received invalid adapter config input. Expected type ids to be an array of strings, but found:')
    })
    it('should throw an error with all invalid types', () => {
      let error: Error | undefined
      try {
        validateFetchParameters({
          types: [
            { name: 'addressForm', ids: ['.*'] },
            { name: 'invalidType', ids: ['.*'] },
          ],
          fileCabinet: [],
        })
      } catch (e) {
        error = e
      }

      expect(error).toBeDefined()
      expect(error?.message).toContain('invalidType')
      expect(error?.message).not.toContain('addressForm')
    })
  })

  describe('andQuery', () => {
    const firstQuery = buildNetsuiteQuery({
      types: [
        { name: 'addressForm', ids: ['aaa.*'] },
        { name: 'advancedpdftemplate', ids: ['.*'] },
        { name: 'Account', ids: ['.*'] },
      ],
      fileCabinet: ['bbb.*'],
    })
    const secondQuery = buildNetsuiteQuery({
      types: [
        { name: 'addressForm', ids: ['.*ccc'] },
        { name: 'bankstatementparserplugin', ids: ['.*'] },
        { name: 'Account', ids: ['.*'] },
      ],
      fileCabinet: ['.*ddd'],
    })
    const bothQuery = andQuery(firstQuery, secondQuery)

    it('should match only types that match both queries', () => {
      expect(bothQuery.isTypeMatch('addressForm')).toBeTruthy()
      expect(bothQuery.isTypeMatch('advancedpdftemplate')).toBeFalsy()
      expect(bothQuery.isTypeMatch('bankstatementparserplugin')).toBeFalsy()
    })

    it('should match all objects if both queries match all objects', () => {
      expect(bothQuery.areAllObjectsMatch('Account')).toBeTruthy()
      expect(bothQuery.areAllObjectsMatch('bankstatementparserplugin')).toBeFalsy()
    })

    it('should match only files that match both queries', () => {
      expect(bothQuery.isFileMatch('bbbdddd')).toBeTruthy()
      expect(bothQuery.isFileMatch('bbb')).toBeFalsy()
      expect(bothQuery.isFileMatch('ddd')).toBeFalsy()
    })

    it('should match only objects that match both queries', () => {
      expect(bothQuery.isObjectMatch({ instanceId: 'aaacccc', type: 'addressForm' })).toBeTruthy()
      expect(bothQuery.isObjectMatch({ instanceId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(bothQuery.isObjectMatch({ instanceId: 'aaa', type: 'advancedpdftemplate' })).toBeFalsy()
    })

    it('should return whether both queries has some files match', () => {
      expect(bothQuery.areSomeFilesMatch()).toBeTruthy()
    })
  })

  describe('notQuery', () => {
    const query = buildNetsuiteQuery({
      types: [
        { name: 'addressForm', ids: ['aaa.*'] },
      ],
      fileCabinet: ['bbb.*'],
    })
    const inverseQuery = notQuery(query)

    it('should match all types', () => {
      expect(inverseQuery.isTypeMatch('addressForm')).toBeTruthy()
      expect(inverseQuery.isTypeMatch('advancedpdftemplate')).toBeTruthy()
    })

    it('should match all objects if did not match any object before', () => {
      expect(inverseQuery.areAllObjectsMatch('Account')).toBeTruthy()
      expect(inverseQuery.areAllObjectsMatch('addressForm')).toBeFalsy()
    })

    it('should match only files that do not match the original query', () => {
      expect(inverseQuery.isFileMatch('bbb')).toBeFalsy()
      expect(inverseQuery.isFileMatch('ddd')).toBeTruthy()
    })

    it('should match only objects that do not match the original query', () => {
      expect(inverseQuery.isObjectMatch({ instanceId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(inverseQuery.isObjectMatch({ instanceId: 'aaa', type: 'advancedpdftemplate' })).toBeTruthy()
      expect(inverseQuery.isObjectMatch({ instanceId: 'bbb', type: 'addressForm' })).toBeTruthy()
    })
  })
})
