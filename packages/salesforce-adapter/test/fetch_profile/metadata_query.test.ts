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

import { buildMetadataQuery, validateMetadataParams } from '../../src/fetch_profile/metadata_query'

describe('validateMetadataParams', () => {
  describe('invalid regex in include list', () => {
    it('invalid metadataType', () => {
      expect(() => validateMetadataParams({
        include: [
          { metadataType: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.metadataType value. The following regular expressions are invalid: (')
    })

    it('invalid namespace', () => {
      expect(() => validateMetadataParams({
        include: [
          { namespace: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.namespace value. The following regular expressions are invalid: (')
    })

    it('invalid name', () => {
      expect(() => validateMetadataParams({
        include: [
          { name: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.name value. The following regular expressions are invalid: (')
    })
  })

  describe('invalid regex in exclude list', () => {
    it('invalid metadataType', () => {
      expect(() => validateMetadataParams({
        exclude: [
          { metadataType: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.metadataType value. The following regular expressions are invalid: (')
    })

    it('invalid namespace', () => {
      expect(() => validateMetadataParams({
        exclude: [
          { namespace: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.namespace value. The following regular expressions are invalid: (')
    })

    it('invalid name', () => {
      expect(() => validateMetadataParams({
        exclude: [
          { name: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.include.name value. The following regular expressions are invalid: (')
    })
  })

  it('valid parameters should not throw', () => {
    expect(() => validateMetadataParams({
      exclude: [
        { name: '.*', metadataType: 'aaaa', namespace: undefined },
      ],
    }, ['aaa'])).not.toThrow()
  })
})

describe('buildMetadataQuery', () => {
  describe('isInstanceMatch', () => {
    it('filter with namespace', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: 'aaa.*' },
        ],
        exclude: [
          { namespace: '.*bbb' },
        ],
      })

      expect(query.isInstanceMatch({ namespace: 'aaaa', metadataType: '', name: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ namespace: 'aaabbb', metadataType: '', name: '' })).toBeFalsy()
      expect(query.isInstanceMatch({ namespace: 'cccc', metadataType: '', name: '' })).toBeFalsy()
    })

    it('filter with metadataType', () => {
      const query = buildMetadataQuery({
        include: [
          { metadataType: 'aaa.*' },
        ],
        exclude: [
          { metadataType: '.*bbb' },
        ],
      })

      expect(query.isInstanceMatch({ metadataType: 'aaaa', namespace: '', name: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ metadataType: 'aaabbb', namespace: '', name: '' })).toBeFalsy()
      expect(query.isInstanceMatch({ metadataType: 'cccc', namespace: '', name: '' })).toBeFalsy()
    })

    it('filter with name', () => {
      const query = buildMetadataQuery({
        include: [
          { name: 'aaa.*' },
        ],
        exclude: [
          { name: '.*bbb' },
        ],
      })

      expect(query.isInstanceMatch({ name: 'aaaa', namespace: '', metadataType: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ name: 'aaabbb', namespace: '', metadataType: '' })).toBeFalsy()
      expect(query.isInstanceMatch({ name: 'cccc', namespace: '', metadataType: '' })).toBeFalsy()
    })

    it('filter with multiple fields', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: 'aaa.*', metadataType: 'bbb.*', name: 'ccc.*' },
        ],
        exclude: [
          { namespace: '.*aaa', metadataType: '.*bbb', name: '.*ccc' },
        ],
      })

      expect(query.isInstanceMatch({ namespace: 'aaabbb', metadataType: 'bbbccc', name: 'cccddd' })).toBeTruthy()
      expect(query.isInstanceMatch({ namespace: 'aaa', metadataType: 'bbb', name: 'ccc' })).toBeFalsy()
      expect(query.isInstanceMatch({ namespace: 'aaabbb', metadataType: '', name: '' })).toBeFalsy()
    })

    it('filter with multiple queries', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: 'aaa.*' },
          { namespace: 'bbb.*' },
        ],
        exclude: [
          { namespace: '.*aaa' },
          { namespace: '.*bbb' },
        ],
      })

      expect(query.isInstanceMatch({ namespace: 'aaaccc', metadataType: '', name: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ namespace: 'bbbccc', metadataType: '', name: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ namespace: 'aaa', metadataType: 'bbb', name: 'ccc' })).toBeFalsy()
      expect(query.isInstanceMatch({ namespace: 'aaabbb', metadataType: '', name: '' })).toBeFalsy()
      expect(query.isInstanceMatch({ namespace: 'bbb', metadataType: '', name: '' })).toBeFalsy()
    })

    it('empty namespace should be tread as "standard"', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: '' },
        ],
      })
      expect(query.isInstanceMatch({ namespace: 'standard', metadataType: '', name: '' })).toBeTruthy()
      expect(query.isInstanceMatch({ namespace: 'notstandard', metadataType: '', name: '' })).toBeFalsy()
    })
  })

  it('isTypeMatch should return correct results', () => {
    const query = buildMetadataQuery({
      include: [
        { metadataType: 'aaa.*' },
      ],
      exclude: [
        { metadataType: '.*bbb' },
        { metadataType: '.*ccc', name: 'someName' },
      ],
    })
    expect(query.isTypeMatch('aaa')).toBeTruthy()
    expect(query.isTypeMatch('ccc')).toBeFalsy()
    expect(query.isTypeMatch('aaabbb')).toBeFalsy()
    expect(query.isTypeMatch('aaaccc')).toBeTruthy()
  })
})
