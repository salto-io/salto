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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { BRAND_TYPE_NAME, GUIDE_THEME_TYPE_NAME, ZENDESK } from '../../src/constants'
import { FilterCreator } from '../../src/filter'
import filterCreator from '../../src/filters/guide_theme'
import * as DownloadModule from '../../src/filters/guide_themes/download'
import { createFilterCreatorParams } from '../utils'

jest.mock('jszip', () => jest.fn().mockImplementation(() => {
  const mockFiles = {
    // Mocked data you expect after loading the zip file
    'file1.txt': { async: jest.fn(() => Buffer.from('file1content')), dir: false },
    'subfolder.dot/file2.txt': { async: jest.fn(() => Buffer.from('file2content')), dir: false },
  }
  const mockCorruptedFiles = {
    'file1.txt': { async: jest.fn(() => { throw new Error('Bad zip file') }) },
  }
  return {
    loadAsync: jest.fn().mockImplementation((buffer: Buffer) => {
      if (buffer.toString() === 'corrupted') {
        return {
          files: mockCorruptedFiles,
        }
      }
      return {
        files: mockFiles,
      }
    }),
  }
}))

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const themeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })

const brand1 = new InstanceElement('brand', brandType, { id: 1, name: 'oneTwo', has_help_center: true })
const theme1 = new InstanceElement('theme', themeType, { id: 'park?', name: 'SixFlags', brand_id: new ReferenceExpression(brand1.elemID) })

describe('filterCreator', () => {
  describe('fetch', () => {
    describe('bad config', () => {
      it('returns undefined if guide is not enabled', async () => {
        expect(await filterCreator(createFilterCreatorParams({})).onFetch?.([brand1, theme1])).toBeUndefined()
      })
      describe('guide is enabled but themes is not', () => {
        let filter: ReturnType<FilterCreator>

        beforeEach(() => {
          const config = { ...DEFAULT_CONFIG }
          config[FETCH_CONFIG].guide = { brands: ['.*'], themesForBrands: [] }
          filter = filterCreator(createFilterCreatorParams({ config }))
        })

        it('returns undefined', async () => {
          expect(await filter.onFetch?.([brand1, theme1])).toBeUndefined()
        })
      })
    })

    describe('good config', () => {
      let filter: ReturnType<FilterCreator>
      let mockDownload: jest.SpyInstance

      beforeEach(() => {
        const config = { ...DEFAULT_CONFIG }
        config[FETCH_CONFIG].guide = { brands: ['.*'], themesForBrands: ['.*'] }
        filter = filterCreator(createFilterCreatorParams({ config }))
        mockDownload = jest.spyOn(DownloadModule, 'download')
      })

      describe('theme download unsuccessful', () => {
        describe('with custom error', () => {
          beforeEach(() => {
            mockDownload.mockResolvedValue({ content: undefined, errors: ['download failed specific error'] })
          })

          it('removes the theme from the elements', async () => {
            const elements = [brand1, theme1]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a warning for the theme', async () => {
            const errors = [{ message: 'Error fetching theme id park?, download failed specific error', severity: 'Warning' }]
            expect(await filter.onFetch?.([brand1, theme1])).toEqual({ errors })
          })
        })

        describe('with no custom error', () => {
          beforeEach(() => {
            mockDownload.mockResolvedValue({ content: undefined, errors: [] })
          })

          it('removes the theme from the elements', async () => {
            const elements = [brand1, theme1]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a default warning for the theme', async () => {
            const errors = [{ message: 'Error fetching theme id park?, no content returned from Zendesk API', severity: 'Warning' }]
            expect(await filter.onFetch?.([brand1, theme1])).toEqual({ errors })
          })
        })
      })

      describe('theme download successful', () => {
        beforeEach(() => {
          mockDownload.mockResolvedValue({ content: Buffer.from('content'), errors: [] })
        })

        it('adds the theme files to the theme', async () => {
          const elements = [brand1, theme1]
          await filter.onFetch?.(elements)
          expect(elements).toEqual([brand1, theme1])
          expect(Object.keys(theme1.value.files)).toHaveLength(2)
          expect(theme1.value.files['file1_txt@v'].filename).toEqual('file1.txt')
          expect(theme1.value.files['file1_txt@v'].content).toEqual(new StaticFile({
            filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/file1.txt`,
            content: Buffer.from('file1content'),
          }))
          expect(theme1.value.files['subfolder_dot@v']['file2_txt@v'].filename).toEqual('subfolder.dot/file2.txt')
          expect(theme1.value.files['subfolder_dot@v']['file2_txt@v'].content).toEqual(new StaticFile({
            filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/subfolder.dot/file2.txt`,
            content: Buffer.from('file2content'),
          }))
        })

        it('returns no errors', async () => {
          expect(await filter.onFetch?.([brand1, theme1])).toEqual({ errors: [] })
        })

        it('removes the theme if brand name is not found', async () => {
          const elements = [theme1]
          await filter.onFetch?.(elements)
          expect(elements).toEqual([])
        })

        it('removes the theme if brand_id is not a reference expression', async () => {
          const theme2 = new InstanceElement('theme', themeType, { id: 'park?', name: 'SixFlags', brand_id: 3 })
          const elements = [theme2, brand1]
          await filter.onFetch?.(elements)
          expect(elements).toEqual([brand1])
        })

        describe('theme download corrupted', () => {
          beforeEach(() => {
            mockDownload.mockResolvedValue({ content: Buffer.from('corrupted'), errors: [] })
          })

          it('removes the theme from the elements', async () => {
            const elements = [brand1, theme1]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a warning for the theme', async () => {
            const errors = [{ message: 'Error fetching theme id park?, Bad zip file', severity: 'Warning' }]
            expect(await filter.onFetch?.([brand1, theme1])).toEqual({ errors })
          })
        })
      })
    })
  })
})
