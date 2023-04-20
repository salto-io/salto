/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { excludeLargeFolders } from '../../src/client/file_cabinet_utils'

describe('excludeLargeFolders', () => {
  it('should not exclude any folders if there is no size overflow', () => {
    const filesToSize = {
      '/folder/path1': 500_000,
      '/folder/path2': 500_000,
    }
    const result = excludeLargeFolders(filesToSize, 1)
    expect(result.largeFolderError).toEqual([])
    expect(result.listedPaths).toEqual(Object.keys(filesToSize))
  })

  describe('when there is a size overflow', () => {
    describe('should exclude the last largest folder if there is a larger than overflow top level folder', () => {
      it('works on absolute paths', () => {
        const filesToSize = {
          '/largeTopFolder/largeFolder/path1': 1_000_000,
          '/largeTopFolder/largeFolder/path2': 1_000_000,
          '/largeTopFolder/smallFolder/path2': 500_000,
          '/smallTopFolder/path1': 500_000,
        }
        const result = excludeLargeFolders(filesToSize, 0.002)
        expect(result.largeFolderError).toEqual(['largeTopFolder/largeFolder'])
        expect(result.listedPaths).toEqual(['/largeTopFolder/smallFolder/path2', '/smallTopFolder/path1'])
      })

      it('works on relative paths', () => {
        const filesToSize = {
          'largeTopFolder/largeFolder/path1': 1_000_000,
          'largeTopFolder/largeFolder/path2': 1_000_000,
          'largeTopFolder/smallFolder/path2': 500_000,
          'smallTopFolder/path1': 500_000,
        }
        const result = excludeLargeFolders(filesToSize, 0.002)
        expect(result.largeFolderError).toEqual(['largeTopFolder/largeFolder'])
        expect(result.listedPaths).toEqual(['largeTopFolder/smallFolder/path2', 'smallTopFolder/path1'])
      })
    })

    it('should exclude multiple largest top level folders if there are no larger than overflow top level folders', () => {
      const filesToSize = {
        '/firstTopFolder/path1': 1_700_000,
        '/thirdTopFolder/path2': 1_500_000,
        '/secondTopFolder/path2': 1_600_000,
        '/fourthTopFolder/path2': 1_400_000,
      }
      const result = excludeLargeFolders(filesToSize, 0.004)
      expect(result.largeFolderError).toEqual(['firstTopFolder', 'secondTopFolder'])
      expect(result.listedPaths).toEqual(['/thirdTopFolder/path2', '/fourthTopFolder/path2'])
    })

    it('should not exclude partial file matches (only by folders)', () => {
      const filesToSize = {
        '/topFolder/folder/path1': 1_700_000,
        '/topFolder/folder_do_not_exclude': 1_500_000,
      }
      const result = excludeLargeFolders(filesToSize, 0.002)
      expect(result.largeFolderError).toEqual(['topFolder/folder'])
      expect(result.listedPaths).toEqual(['/topFolder/folder_do_not_exclude'])
    })
  })
})
