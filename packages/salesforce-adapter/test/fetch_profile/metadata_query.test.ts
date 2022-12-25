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

import { buildMetadataQuery, validateMetadataParams, MetadataQuery } from '../../src/fetch_profile/metadata_query'
import { CUSTOM_OBJECT, TOPICS_FOR_OBJECTS_METADATA_TYPE } from '../../src/constants'
import {
  FolderMetadataType,
  InFolderMetadataType,
  METADATA_TYPE_TO_FOLDER_TYPE,
} from '../../src/fetch_profile/metadata_types'

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
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.exclude.metadataType value. The following regular expressions are invalid: (')
    })

    it('invalid namespace', () => {
      expect(() => validateMetadataParams({
        exclude: [
          { namespace: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.exclude.namespace value. The following regular expressions are invalid: (')
    })

    it('invalid name', () => {
      expect(() => validateMetadataParams({
        exclude: [
          { name: '(' },
        ],
      }, ['aaa'])).toThrow('Failed to load config due to an invalid aaa.exclude.name value. The following regular expressions are invalid: (')
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

    it('should return InstalledPackage with namespace if \'\' namespace is provided', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: '' },
        ],
      })
      expect(query.isInstanceMatch({ namespace: 'SBQQ', metadataType: 'InstalledPackage', name: 'lala' })).toBeTruthy()
    })

    it('should not return InstalledPackage with a different namespace then one specifically provided', () => {
      const query = buildMetadataQuery({
        include: [
          { namespace: 'SBAA' },
        ],
      })
      expect(query.isInstanceMatch({ namespace: 'SBQQ', metadataType: 'InstalledPackage', name: 'lala' })).toBeFalsy()
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

  describe('with fetch target', () => {
    let query: MetadataQuery
    beforeEach(() => {
      query = buildMetadataQuery(
        {
          include: [{ metadataType: '.*' }],
          exclude: [{ metadataType: 'exclude' }],
        },
        ['target', 'exclude', CUSTOM_OBJECT],
      )
    })
    describe('isPartialFetch', () => {
      it('should return true', () => {
        expect(query.isPartialFetch()).toBeTruthy()
      })
    })
    describe('isTypeMatch', () => {
      it('should match types in the fetch target', () => {
        expect(query.isTypeMatch('target')).toBeTruthy()
      })
      it('should not match types that are included but not in the fetch target', () => {
        expect(query.isTypeMatch('meta')).toBeFalsy()
      })
      it('should not match excluded types even if they are in the target', () => {
        expect(query.isTypeMatch('exclude')).toBeFalsy()
      })
      it('should match topics for objects when custom object is in the target', () => {
        expect(query.isTypeMatch(TOPICS_FOR_OBJECTS_METADATA_TYPE)).toBeTruthy()
      })
    })
  })
  describe('with InFolderMetadataType', () => {
    let inFolderType: InFolderMetadataType
    let query: MetadataQuery
    beforeEach(() => {
      inFolderType = 'Report'
      query = buildMetadataQuery({
        include: [
          {
            metadataType: inFolderType,
          },
          {
            metadataType: METADATA_TYPE_TO_FOLDER_TYPE[inFolderType],
            name: '^(TopFolder|TopFolder/NestedFolder|TopFolder/NestedFolder/NestedNestedFolder)$',
          },
          // The names .* and NestedFolder1? Should not be in the result
          {
            metadataType: METADATA_TYPE_TO_FOLDER_TYPE[inFolderType],
            name: '.*|NestedFolder1?',
          },
        ],
      })
    })
    describe('getFolderPathsByName', () => {
      it('should return correct folders', () => {
        expect(query.getFolderPathsByName(inFolderType)).toEqual({
          TopFolder: 'TopFolder',
          NestedFolder: 'TopFolder/NestedFolder',
          NestedNestedFolder: 'TopFolder/NestedFolder/NestedNestedFolder',
        })
      })
    })
  })
  describe('with FolderMetadataType', () => {
    let folderType: FolderMetadataType
    let query: MetadataQuery

    describe('with included full paths', () => {
      beforeEach(() => {
        folderType = 'ReportFolder'
        query = buildMetadataQuery({
          include: [
            {
              metadataType: folderType,
              name: '^(TopFolder|TopFolder/NestedFolder|TopFolder/NestedFolder/NestedNestedFolder)$',
            },
          ],
        })
      })
      it.each([
        'TopFolder',
        'NestedFolder',
        'NestedNestedFolder',
      ])('should match folder %p', folderName => {
        expect(query.isInstanceMatch({
          metadataType: folderType,
          namespace: '',
          name: folderName,
        })).toBeTrue()
      })

      it.each([
        'NonIncludedFolder',
        'NonIncludedNestedFolder',
      ])('should not match folder %p', folderName => {
        expect(query.isInstanceMatch({
          metadataType: folderType,
          namespace: '',
          name: folderName,
        })).toBeFalse()
      })
    })
    describe('with included wildcard', () => {
      beforeEach(() => {
        folderType = 'ReportFolder'
        query = buildMetadataQuery({
          include: [
            {
              metadataType: folderType,
            },
          ],
        })
      })
      it.each([
        'TopFolder',
        'NestedFolder',
        'NestedNestedFolder',
      ])('should match folder %p', folderName => {
        expect(query.isInstanceMatch({
          metadataType: folderType,
          namespace: '',
          name: folderName,
        })).toBeTrue()
      })
    })
    describe('with included regex paths', () => {
      beforeEach(() => {
        folderType = 'ReportFolder'
        query = buildMetadataQuery({
          include: [
            {
              metadataType: folderType,
              name: '^(TopFolder1?|TopFolder[23])$',
            },
          ],
        })
      })
      it.each([
        'TopFolder',
        'TopFolder1',
        'TopFolder2',
        'TopFolder3',
      ])('should match folder %p', folderName => {
        expect(query.isInstanceMatch({
          metadataType: folderType,
          namespace: '',
          name: folderName,
        })).toBeTrue()
      })

      it.each([
        'TopFolder4',
        'NestedFolder',
      ])('should not match folder %p', folderName => {
        expect(query.isInstanceMatch({
          metadataType: folderType,
          namespace: '',
          name: folderName,
        })).toBeFalse()
      })
    })
  })
})
