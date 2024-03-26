/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FileProperties } from '@salto-io/jsforce'
import {
  buildFilePropsMetadataQuery,
  buildMetadataQuery,
  buildMetadataQueryForFetchWithChangesDetection,
  validateMetadataParams,
} from '../../src/fetch_profile/metadata_query'
import {
  CUSTOM_OBJECT,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
} from '../../src/constants'
import { MetadataInstance, MetadataQuery } from '../../src/types'
import { mockInstances } from '../mock_elements'
import { mockFileProperties } from '../connection'
import { emptyLastChangeDateOfTypesWithNestedInstances } from '../utils'

describe('validateMetadataParams', () => {
  describe('invalid regex in include list', () => {
    it('invalid metadataType', () => {
      expect(() =>
        validateMetadataParams(
          {
            include: [{ metadataType: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.include.metadataType value. The following regular expressions are invalid: (',
      )
    })

    it('invalid namespace', () => {
      expect(() =>
        validateMetadataParams(
          {
            include: [{ namespace: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.include.namespace value. The following regular expressions are invalid: (',
      )
    })

    it('invalid name', () => {
      expect(() =>
        validateMetadataParams(
          {
            include: [{ name: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.include.name value. The following regular expressions are invalid: (',
      )
    })
  })

  describe('invalid regex in exclude list', () => {
    it('invalid metadataType', () => {
      expect(() =>
        validateMetadataParams(
          {
            exclude: [{ metadataType: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.exclude.metadataType value. The following regular expressions are invalid: (',
      )
    })

    it('invalid namespace', () => {
      expect(() =>
        validateMetadataParams(
          {
            exclude: [{ namespace: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.exclude.namespace value. The following regular expressions are invalid: (',
      )
    })

    it('invalid name', () => {
      expect(() =>
        validateMetadataParams(
          {
            exclude: [{ name: '(' }],
          },
          ['aaa'],
        ),
      ).toThrow(
        'Failed to load config due to an invalid aaa.exclude.name value. The following regular expressions are invalid: (',
      )
    })
  })

  it('valid parameters should not throw', () => {
    expect(() =>
      validateMetadataParams(
        {
          exclude: [{ name: '.*', metadataType: 'aaaa', namespace: undefined }],
        },
        ['aaa'],
      ),
    ).not.toThrow()
  })
})

describe('buildMetadataQuery', () => {
  describe('isInstanceMatch', () => {
    it('filter with namespace', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ namespace: 'aaa.*' }],
            exclude: [{ namespace: '.*bbb' }],
          },
        },
      })

      expect(
        query.isInstanceMatch({
          namespace: 'aaaa',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          namespace: 'aaabbb',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          namespace: 'cccc',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it('filter with metadataType', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ metadataType: 'aaa.*' }],
            exclude: [{ metadataType: '.*bbb' }],
          },
        },
      })

      expect(
        query.isInstanceMatch({
          metadataType: 'aaaa',
          namespace: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          metadataType: 'aaabbb',
          namespace: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          metadataType: 'cccc',
          namespace: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it('filter with name', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ name: 'aaa.*' }],
            exclude: [{ name: '.*bbb' }],
          },
        },
      })

      expect(
        query.isInstanceMatch({
          name: 'aaaa',
          namespace: '',
          metadataType: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          name: 'aaabbb',
          namespace: '',
          metadataType: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          name: 'cccc',
          namespace: '',
          metadataType: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it('filter with multiple fields', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [
              { namespace: 'aaa.*', metadataType: 'bbb.*', name: 'ccc.*' },
            ],
            exclude: [
              { namespace: '.*aaa', metadataType: '.*bbb', name: '.*ccc' },
            ],
          },
        },
      })

      expect(
        query.isInstanceMatch({
          namespace: 'aaabbb',
          metadataType: 'bbbccc',
          name: 'cccddd',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          namespace: 'aaa',
          metadataType: 'bbb',
          name: 'ccc',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          namespace: 'aaabbb',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it('filter with multiple queries', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ namespace: 'aaa.*' }, { namespace: 'bbb.*' }],
            exclude: [{ namespace: '.*aaa' }, { namespace: '.*bbb' }],
          },
        },
      })

      expect(
        query.isInstanceMatch({
          namespace: 'aaaccc',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          namespace: 'bbbccc',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          namespace: 'aaa',
          metadataType: 'bbb',
          name: 'ccc',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          namespace: 'aaabbb',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
      expect(
        query.isInstanceMatch({
          namespace: 'bbb',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it('empty namespace should be tread as "standard"', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ namespace: '' }],
          },
        },
      })
      expect(
        query.isInstanceMatch({
          namespace: 'standard',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
      expect(
        query.isInstanceMatch({
          namespace: 'notstandard',
          metadataType: '',
          name: '',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })

    it("should return InstalledPackage with namespace if '' namespace is provided", () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ namespace: '' }],
          },
        },
      })
      expect(
        query.isInstanceMatch({
          namespace: 'SBQQ',
          metadataType: 'InstalledPackage',
          name: 'lala',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeTruthy()
    })

    it('should not return InstalledPackage with a different namespace then one specifically provided', () => {
      const query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ namespace: 'SBAA' }],
          },
        },
      })
      expect(
        query.isInstanceMatch({
          namespace: 'SBQQ',
          metadataType: 'InstalledPackage',
          name: 'lala',
          isFolderType: false,
          changedAt: undefined,
        }),
      ).toBeFalsy()
    })
  })

  it('isTypeMatch should return correct results', () => {
    const query = buildMetadataQuery({
      fetchParams: {
        metadata: {
          include: [{ metadataType: 'aaa.*' }],
          exclude: [
            { metadataType: '.*bbb' },
            { metadataType: '.*ccc', name: 'someName' },
          ],
        },
      },
    })
    expect(query.isTypeMatch('aaa')).toBeTruthy()
    expect(query.isTypeMatch('ccc')).toBeFalsy()
    expect(query.isTypeMatch('aaabbb')).toBeFalsy()
    expect(query.isTypeMatch('aaaccc')).toBeTruthy()
  })

  describe('with fetch target', () => {
    let query: MetadataQuery
    beforeEach(() => {
      query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{ metadataType: '.*' }],
            exclude: [{ metadataType: 'exclude' }],
          },
          target: ['target', 'exclude', CUSTOM_OBJECT],
        },
      })
    })
    describe('isPartialFetch', () => {
      it('should return true', () => {
        expect(query.isPartialFetch()).toBeTruthy()
      })
    })
    describe('isTargetedFetch', () => {
      it('should return true', () => {
        expect(query.isTargetedFetch()).toBeTruthy()
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
    const inFolderType = 'Report'
    const folderType = `${inFolderType}Folder`
    let query: MetadataQuery
    beforeEach(() => {
      query = buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [
              {
                metadataType: inFolderType,
              },
              {
                metadataType: folderType,
                name: '^(TopFolder|TopFolder/NestedFolder|TopFolder/NestedFolder/NestedNestedFolder)$',
              },
              // Folder names with underscores and numbers
              {
                metadataType: folderType,
                name: '^(UnderscoreFolder_cx|TopFolder/NestedUnderscoreFolder_12)$',
              },
              // The names .* and NestedFolder1? Should not be in the result
              {
                metadataType: folderType,
                name: '.*|NestedFolder1?',
              },
            ],
          },
        },
      })
    })
    describe('getFolderPathsByName', () => {
      it('should return correct folders', () => {
        expect(query.getFolderPathsByName(folderType)).toEqual({
          TopFolder: 'TopFolder',
          NestedFolder: 'TopFolder/NestedFolder',
          NestedNestedFolder: 'TopFolder/NestedFolder/NestedNestedFolder',
          UnderscoreFolder_cx: 'UnderscoreFolder_cx',
          NestedUnderscoreFolder_12: 'TopFolder/NestedUnderscoreFolder_12',
        })
      })
    })
  })
  describe('with FolderMetadataType', () => {
    const folderType = 'ReportFolder'
    let query: MetadataQuery

    describe('with included full paths', () => {
      beforeEach(() => {
        query = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: folderType,
                  name: '^(TopFolder|TopFolder/NestedFolder|TopFolder/NestedFolder/NestedNestedFolder)$',
                },
              ],
            },
          },
        })
      })
      it.each(['TopFolder', 'NestedFolder', 'NestedNestedFolder'])(
        'should match folder %p',
        (folderName) => {
          expect(
            query.isInstanceMatch({
              metadataType: folderType,
              namespace: '',
              name: folderName,
              isFolderType: true,
              changedAt: undefined,
            }),
          ).toBeTrue()
        },
      )

      it.each(['NonIncludedFolder', 'NonIncludedNestedFolder'])(
        'should not match folder %p',
        (folderName) => {
          expect(
            query.isInstanceMatch({
              metadataType: folderType,
              namespace: '',
              name: folderName,
              isFolderType: true,
              changedAt: undefined,
            }),
          ).toBeFalse()
        },
      )
    })
    describe('with included wildcard', () => {
      beforeEach(() => {
        query = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: folderType,
                },
              ],
            },
          },
        })
      })
      it.each(['TopFolder', 'NestedFolder', 'NestedNestedFolder'])(
        'should match folder %p',
        (folderName) => {
          expect(
            query.isInstanceMatch({
              metadataType: folderType,
              namespace: '',
              name: folderName,
              isFolderType: true,
              changedAt: undefined,
            }),
          ).toBeTrue()
        },
      )
    })
    describe('with included regex paths', () => {
      beforeEach(() => {
        query = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: folderType,
                  name: '^(TopFolder1?|TopFolder[23])$',
                },
              ],
            },
          },
        })
      })
      it.each(['TopFolder', 'TopFolder1', 'TopFolder2', 'TopFolder3'])(
        'should match folder %p',
        (folderName) => {
          expect(
            query.isInstanceMatch({
              metadataType: folderType,
              namespace: '',
              name: folderName,
              isFolderType: true,
              changedAt: undefined,
            }),
          ).toBeTrue()
        },
      )

      it.each(['TopFolder4', 'NestedFolder'])(
        'should not match folder %p',
        (folderName) => {
          expect(
            query.isInstanceMatch({
              metadataType: folderType,
              namespace: '',
              name: folderName,
              isFolderType: true,
              changedAt: undefined,
            }),
          ).toBeFalse()
        },
      )
    })
    describe('isFetchWithChangesDetection', () => {
      it('should return false', () => {
        expect(
          buildMetadataQuery({ fetchParams: {} }).isFetchWithChangesDetection(),
        ).toBeFalse()
      })
    })
    describe('isInstanceIncluded', () => {
      it('should have the same implementation as isInstanceMatch', () => {
        const metadataQuery = buildMetadataQuery({ fetchParams: {} })
        expect(metadataQuery.isInstanceIncluded).toEqual(
          metadataQuery.isInstanceMatch,
        )
      })
    })
  })
  describe('buildMetadataQueryForFetchWithChangesDetection', () => {
    const INCLUDED_TYPE = 'Role'
    const EXCLUDED_TYPE = 'CustomLabels'

    let changedAtSingleton: InstanceElement
    let metadataQuery: MetadataQuery
    beforeEach(async () => {
      changedAtSingleton = mockInstances().ChangedAtSingleton
      const elementsSource = buildElementsSourceFromElements([
        changedAtSingleton,
      ])
      metadataQuery = await buildMetadataQueryForFetchWithChangesDetection({
        fetchParams: {
          metadata: {
            include: [
              {
                metadataType: '.*',
              },
            ],
            exclude: [{ metadataType: 'CustomLabels' }],
          },
        },
        elementsSource,
        lastChangeDateOfTypesWithNestedInstances:
          emptyLastChangeDateOfTypesWithNestedInstances(),
      })
    })
    describe('when is first fetch', () => {
      it('should throw Error', async () => {
        await expect(
          buildMetadataQueryForFetchWithChangesDetection({
            fetchParams: {
              metadata: {
                include: [
                  {
                    metadataType: '.*',
                  },
                ],
                exclude: [{ metadataType: 'CustomLabels' }],
              },
            },
            // In first fetch, the ChangedAtSingleton won't be defined
            elementsSource: buildElementsSourceFromElements([]),
            lastChangeDateOfTypesWithNestedInstances:
              emptyLastChangeDateOfTypesWithNestedInstances(),
          }),
        ).rejects.toThrow()
      })
    })
    describe('isFetchWithChangesDetection', () => {
      it('should return true', () => {
        expect(metadataQuery.isFetchWithChangesDetection()).toBeTrue()
      })
    })
    describe('isPartialFetch', () => {
      it('should return true', () => {
        expect(metadataQuery.isPartialFetch()).toBeTrue()
      })
    })
    describe('isTargetedFetch', () => {
      describe('without fetch targets', () => {
        it('should return false', () => {
          expect(metadataQuery.isTargetedFetch()).toBeFalse()
        })
      })
      describe('with fetch targets', () => {
        beforeEach(async () => {
          metadataQuery = await buildMetadataQueryForFetchWithChangesDetection({
            fetchParams: { target: ['CustomObject'] },
            elementsSource: buildElementsSourceFromElements([
              changedAtSingleton,
            ]),
            lastChangeDateOfTypesWithNestedInstances:
              emptyLastChangeDateOfTypesWithNestedInstances(),
          })
        })
        it('should return true', () => {
          expect(metadataQuery.isTargetedFetch()).toBeTrue()
        })
      })
    })
    describe('isTypeMatch', () => {
      it('should return true for included type', () => {
        expect(metadataQuery.isTypeMatch(INCLUDED_TYPE)).toBeTrue()
      })
      it('should return false for excluded type', () => {
        expect(metadataQuery.isTypeMatch(EXCLUDED_TYPE)).toBeFalse()
      })
    })
    describe('isInstanceIncluded & isInstanceMatch', () => {
      const UPDATED_INSTANCE_NAME = 'Updated'
      const NON_UPDATED_INSTANCE_NAME = 'NonUpdated'

      let instance: MetadataInstance

      beforeEach(() => {
        changedAtSingleton.value[INCLUDED_TYPE] = {
          [UPDATED_INSTANCE_NAME]: '2023-11-06T00:00:00.000Z',
          [NON_UPDATED_INSTANCE_NAME]: '2023-11-06T00:00:00.000Z',
        }
      })
      describe('when instance was updated', () => {
        beforeEach(() => {
          instance = {
            metadataType: INCLUDED_TYPE,
            namespace: '',
            name: UPDATED_INSTANCE_NAME,
            isFolderType: false,
            changedAt: '2023-11-07T00:00:00.000Z',
          }
        })
        describe('isInstanceIncluded', () => {
          it('should return true', () => {
            expect(metadataQuery.isInstanceIncluded(instance)).toBeTrue()
          })
        })
        describe('isInstanceMatch', () => {
          it('should return true', () => {
            expect(metadataQuery.isInstanceMatch(instance)).toBeTrue()
          })
        })
      })
      describe('when instance was not updated', () => {
        beforeEach(() => {
          instance = {
            metadataType: INCLUDED_TYPE,
            namespace: '',
            name: UPDATED_INSTANCE_NAME,
            isFolderType: false,
            changedAt: '2023-11-06T00:00:00.000Z',
          }
        })
        describe('isInstanceIncluded', () => {
          it('should return true', () => {
            expect(metadataQuery.isInstanceIncluded(instance)).toBeTrue()
          })
        })
        describe('isInstanceMatch', () => {
          it('should return false', () => {
            expect(metadataQuery.isInstanceMatch(instance)).toBeFalse()
          })
        })
      })
    })
  })
  describe('buildFilePropsMetadataQuery', () => {
    const CHANGED_AT = '2023-11-07T00:00:00.000Z'

    let fileProps: FileProperties
    let metadataQuery: jest.Mocked<MetadataQuery>
    let filePropsMetadataQuery: MetadataQuery<FileProperties>
    beforeEach(() => {
      metadataQuery = {
        isInstanceIncluded: jest.fn(),
        isInstanceMatch: jest.fn(),
        isTypeMatch: jest.fn(),
        isFetchWithChangesDetection: jest.fn(),
        isPartialFetch: jest.fn(),
        isTargetedFetch: jest.fn(),
        getFolderPathsByName: jest.fn(),
        logData: jest.fn(),
      }
      filePropsMetadataQuery = buildFilePropsMetadataQuery(metadataQuery)
    })
    describe('isInstanceMatch & isInstanceIncluded', () => {
      describe('when fileProps are of instance without namespace', () => {
        beforeEach(() => {
          fileProps = mockFileProperties({
            fullName: 'Account',
            type: 'CustomObject',
            namespacePrefix: '',
            lastModifiedDate: CHANGED_AT,
          })
        })
        it('should invoke the underlying MetadataQuery with correct MetadataInstance', () => {
          filePropsMetadataQuery.isInstanceMatch(fileProps)
          expect(metadataQuery.isInstanceMatch).toHaveBeenCalledWith({
            metadataType: 'CustomObject',
            namespace: 'standard',
            name: 'Account',
            isFolderType: false,
            changedAt: CHANGED_AT,
          })
          filePropsMetadataQuery.isInstanceIncluded(fileProps)
          expect(metadataQuery.isInstanceIncluded).toHaveBeenCalledWith({
            metadataType: 'CustomObject',
            namespace: 'standard',
            name: 'Account',
            isFolderType: false,
            changedAt: CHANGED_AT,
          })
        })
      })
      describe('when fileProps are of instance with namespace', () => {
        const NAMESPACE = 'test'
        beforeEach(() => {
          fileProps = mockFileProperties({
            fullName: 'Account',
            type: 'CustomObject',
            namespacePrefix: NAMESPACE,
            lastModifiedDate: CHANGED_AT,
          })
        })
        it('should invoke the underlying MetadataQuery with correct MetadataInstance', () => {
          filePropsMetadataQuery.isInstanceMatch(fileProps)
          expect(metadataQuery.isInstanceMatch).toHaveBeenCalledWith({
            metadataType: 'CustomObject',
            namespace: NAMESPACE,
            name: 'Account',
            isFolderType: false,
            changedAt: CHANGED_AT,
          })
          filePropsMetadataQuery.isInstanceIncluded(fileProps)
          expect(metadataQuery.isInstanceIncluded).toHaveBeenCalledWith({
            metadataType: 'CustomObject',
            namespace: NAMESPACE,
            name: 'Account',
            isFolderType: false,
            changedAt: CHANGED_AT,
          })
        })
      })
    })
  })
})
