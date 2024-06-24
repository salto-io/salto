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
import {
  AdditionChange,
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { staticFileToTemplateExpression } from '@salto-io/parser/src/utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { BRAND_TYPE_NAME, GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { FilterCreator } from '../../src/filter'
import filterCreator from '../../src/filters/guide_theme'
import * as DownloadModule from '../../src/filters/guide_themes/download'
import * as CreateModule from '../../src/filters/guide_themes/create'
import * as DeleteModule from '../../src/filters/guide_themes/delete'
import * as PublishModule from '../../src/filters/guide_themes/publish'
import { createFilterCreatorParams } from '../utils'

jest.mock('jszip', () =>
  jest.fn().mockImplementation(() => {
    const mockFiles = {
      // Mocked data you expect after loading the zip file
      'file1.txt': { async: jest.fn(() => Buffer.from('file1content')), dir: false },
      'subfolder.dot/file2.txt': { async: jest.fn(() => Buffer.from('file2content')), dir: false },
      'fileWithReference.js': { async: jest.fn(() => Buffer.from('var SUPER_DUPER_PREFIX_123 = 123')), dir: false },
    }
    const mockCorruptedFiles = {
      'file1.txt': {
        async: jest.fn(() => {
          throw new Error('Bad zip file')
        }),
      },
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
  }),
)

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const themeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
const themeSettingsType = new ObjectType({
  elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME),
  fields: {
    brand: { refType: BuiltinTypes.NUMBER },
    liveTheme: { refType: BuiltinTypes.STRING },
  },
  path: [ZENDESK, 'Types', THEME_SETTINGS_TYPE_NAME],
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

const brand1 = new InstanceElement('brand', brandType, {
  id: 1,
  name: 'oneTwo',
  has_help_center: true,
  brand_url: 'url',
})
const themeWithId = new InstanceElement('themeWithId', themeType, {
  id: 'park?',
  name: 'SixFlags',
  brand_id: new ReferenceExpression(brand1.elemID, brand1),
})
const newThemeWithFiles = new InstanceElement('newThemeWithFiles', themeType, {
  name: 'SevenFlags',
  brand_id: new ReferenceExpression(brand1.elemID, brand1),
  root: {
    files: {
      'file1_txt@v': {
        filename: 'file1.txt',
        content: Buffer.from('file1content'),
      },
      'fileWithReference_js@v': {
        filename: 'fileWithReference.js',
        content: new TemplateExpression({
          parts: ['var PREFIX_123 = ', new ReferenceExpression(brand1.elemID, brand1)],
        }),
      },
    },
    folders: {},
  },
})

const themeSettingsInstance = new InstanceElement(`${brand1.value.name}_settings`, themeSettingsType, {
  brand: new ReferenceExpression(brand1.elemID),
  liveTheme: new ReferenceExpression(themeWithId.elemID),
})

const themeSettingsInstance2 = new InstanceElement(`${brand1.value.name}_settings`, themeSettingsType, {
  brand: new ReferenceExpression(brand1.elemID),
  liveTheme: new ReferenceExpression(newThemeWithFiles.elemID),
})

const articleInstance = new InstanceElement('article', new ObjectType({ elemID: new ElemID('test', 'article') }), {
  id: 123,
})

describe('filterCreator', () => {
  describe('fetch', () => {
    describe('bad config', () => {
      it('returns undefined if guide is not enabled', async () => {
        expect(await filterCreator(createFilterCreatorParams({})).onFetch?.([brand1, themeWithId])).toBeUndefined()
      })
      describe('guide is enabled but themes is not', () => {
        let filter: ReturnType<FilterCreator>

        beforeEach(() => {
          const config = { ...DEFAULT_CONFIG }
          config[FETCH_CONFIG].guide = {
            brands: ['.*'],
            themes: {
              brands: [],
              referenceOptions: {
                enableReferenceLookup: false,
              },
            },
          }
          filter = filterCreator(createFilterCreatorParams({ config }))
        })

        it('returns undefined', async () => {
          expect(await filter.onFetch?.([brand1, themeWithId])).toBeUndefined()
        })
      })
    })

    describe('good config', () => {
      let filter: ReturnType<FilterCreator>
      let mockDownload: jest.SpyInstance

      beforeEach(() => {
        const config = { ...DEFAULT_CONFIG }
        config[FETCH_CONFIG].guide = {
          brands: ['.*'],
          themes: {
            brands: ['.*'],
            referenceOptions: {
              enableReferenceLookup: true,
              javascriptReferenceLookupStrategy: {
                strategy: 'varNamePrefix',
                prefix: 'SUPER_DUPER_PREFIX_',
              },
            },
          },
        }
        filter = filterCreator(
          createFilterCreatorParams({ config, elementsSource: buildElementsSourceFromElements([articleInstance]) }),
        )
        mockDownload = jest.spyOn(DownloadModule, 'download')
      })

      describe('theme download unsuccessful', () => {
        describe('with custom error', () => {
          beforeEach(() => {
            mockDownload.mockResolvedValue({ content: undefined, errors: ['download failed specific error'] })
          })

          it('removes the theme from the elements', async () => {
            const elements = [brand1, themeWithId]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a warning for the theme', async () => {
            const errors = [
              { message: 'Error fetching theme id park?, download failed specific error', severity: 'Warning' },
            ]
            expect(await filter.onFetch?.([brand1, themeWithId])).toEqual({ errors })
          })
        })

        describe('with no custom error', () => {
          beforeEach(() => {
            mockDownload.mockResolvedValue({ content: undefined, errors: [] })
          })

          it('removes the theme from the elements', async () => {
            const elements = [brand1, themeWithId]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a default warning for the theme', async () => {
            const errors = [
              { message: 'Error fetching theme id park?, no content returned from Zendesk API', severity: 'Warning' },
            ]
            expect(await filter.onFetch?.([brand1, themeWithId])).toEqual({ errors })
          })
        })
      })

      describe('theme download successful', () => {
        beforeEach(() => {
          mockDownload.mockResolvedValue({ content: Buffer.from('content'), errors: [] })
        })

        it('adds the theme files to the themes', async () => {
          const liveThemeWithId = themeWithId.clone()
          liveThemeWithId.value.live = true
          const nonLiveThemeWithId = themeWithId.clone()
          nonLiveThemeWithId.value.live = false
          const elements = [brand1, liveThemeWithId, nonLiveThemeWithId]
          await filter.onFetch?.(elements)
          expect(Object.keys(liveThemeWithId.value.root)).toHaveLength(2)
          expect(liveThemeWithId.value.root.files['file1_txt@v'].filename).toEqual('file1.txt')
          expect(liveThemeWithId.value.root.files['file1_txt@v'].content).toEqual(
            new StaticFile({
              filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/file1.txt`,
              content: Buffer.from('file1content'),
            }),
          )
          expect(liveThemeWithId.value.root.folders['subfolder_dot@v'].files['file2_txt@v'].filename).toEqual(
            'subfolder.dot/file2.txt',
          )
          expect(liveThemeWithId.value.root.folders['subfolder_dot@v'].files['file2_txt@v'].content).toEqual(
            new StaticFile({
              filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/subfolder.dot/file2.txt`,
              content: Buffer.from('file2content'),
            }),
          )
          const templateExpression = await staticFileToTemplateExpression(
            liveThemeWithId.value.root.files['fileWithReference_js@v'].content,
          )
          expect(templateExpression).toEqual({
            parts: ['var SUPER_DUPER_PREFIX_123 = ', new ReferenceExpression(articleInstance.elemID)],
          })

          expect(Object.keys(nonLiveThemeWithId.value.root)).toHaveLength(2)
          expect(nonLiveThemeWithId.value.root.files['file1_txt@v'].content).toEqual(
            new StaticFile({
              filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/file1.txt`,
              content: Buffer.from('file1content'),
            }),
          )
          expect(nonLiveThemeWithId.value.root.folders['subfolder_dot@v'].files['file2_txt@v'].content).toEqual(
            new StaticFile({
              filepath: `${ZENDESK}/themes/brands/oneTwo/SixFlags/subfolder.dot/file2.txt`,
              content: Buffer.from('file2content'),
            }),
          )
        })

        it('returns no errors', async () => {
          expect(await filter.onFetch?.([brand1, themeWithId])).toEqual({ errors: [] })
        })

        it('removes the theme if brand name is not found', async () => {
          const elements = [themeWithId]
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
            const elements = [brand1, themeWithId]
            await filter.onFetch?.(elements)
            expect(elements).toEqual([brand1])
          })

          it('returns a warning for the theme', async () => {
            const errors = [{ message: 'Error fetching theme id park?, Bad zip file', severity: 'Warning' }]
            expect(await filter.onFetch?.([brand1, themeWithId])).toEqual({ errors })
          })
        })
      })
    })
  })
  describe('deploy', () => {
    let filter: ReturnType<FilterCreator>
    let mockCreate: jest.SpyInstance
    let mockDelete: jest.SpyInstance
    let mockPublish: jest.SpyInstance

    beforeEach(() => {
      jest.resetAllMocks()
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].guide = {
        brands: ['.*'],
        themes: {
          brands: ['.*'],
          referenceOptions: {
            enableReferenceLookup: false,
          },
        },
      }
      filter = filterCreator(
        createFilterCreatorParams({ config, elementsSource: buildElementsSourceFromElements([themeSettingsInstance]) }),
      )
      mockCreate = jest.spyOn(CreateModule, 'create')
      mockDelete = jest.spyOn(DeleteModule, 'deleteTheme')
      mockPublish = jest.spyOn(PublishModule, 'publish')
    })

    describe('with no elements', () => {
      it('should not call create, update or delete', async () => {
        await filter.deploy?.([])
        expect(mockCreate).not.toHaveBeenCalled()
      })
    })
    describe('with invalid elements', () => {
      beforeEach(() => {
        mockCreate.mockResolvedValue({ themeId: 'newId', errors: [] })
        mockPublish.mockResolvedValue([])
      })
      it('should fail with an invalid theme', async () => {
        const invalidTheme = new InstanceElement('invalidTheme', themeType, {
          name: 'SevenFlags',
          brand_id: new ReferenceExpression(brand1.elemID, brand1),
          root: {},
        })
        const changes = [toChange({ after: invalidTheme })]
        expect(await filter.deploy?.(changes)).toEqual({
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                elemID: invalidTheme.elemID,
                message: 'Invalid theme directory',
                severity: 'Error',
              },
            ],
          },
          leftoverChanges: [],
        })
        expect((changes[0] as AdditionChange<InstanceElement>).data.after.value.id).toEqual('newId')
        expect(mockCreate).toHaveBeenCalled()
        expect(mockPublish).not.toHaveBeenCalled()
      })

      it('should fail with a file with unresolved reference', async () => {
        const elemID = new ElemID('adapter', 'test', 'instance', 'not', 'top', 'level')
        const invalidTheme = new InstanceElement('invalidTheme', themeType, {
          name: 'SevenFlags',
          brand_id: new ReferenceExpression(brand1.elemID, brand1),
          root: {
            files: {
              'fileWithReference_js@v': {
                filename: 'fileWithReference.js',
                content: new TemplateExpression({
                  parts: ['var SUPER_DUPER_PREFIX_123 = ', new ReferenceExpression(elemID, { invalid: 'ref' })],
                }),
              },
            },
            folders: {},
          },
        })
        const changes = [toChange({ after: invalidTheme })]
        expect(await filter.deploy?.(changes)).toEqual({
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                elemID: invalidTheme.elemID,
                message: 'Error while resolving references in file fileWithReference.js',
                severity: 'Error',
              },
            ],
          },
          leftoverChanges: [],
        })
        expect((changes[0] as AdditionChange<InstanceElement>).data.after.value.id).toEqual('newId')
        expect(mockCreate).toHaveBeenCalled()
        expect(mockPublish).not.toHaveBeenCalled()
      })
    })

    describe('create theme', () => {
      let changes: Change<InstanceElement>[]

      beforeEach(() => {
        changes = [toChange({ after: newThemeWithFiles.clone() })]
      })

      describe('with no errors', () => {
        beforeEach(() => {
          mockCreate.mockResolvedValue({ themeId: 'newId', errors: [] })
          mockPublish.mockResolvedValue([])
        })

        it('should apply the change and return no errors', async () => {
          expect(await filter.deploy?.(changes)).toEqual({
            deployResult: { appliedChanges: changes, errors: [] },
            leftoverChanges: [],
          })
          expect((changes[0] as AdditionChange<InstanceElement>).data.after.value.id).toEqual('newId')
          expect(mockCreate).toHaveBeenCalledWith(
            {
              brandId: new ReferenceExpression(brand1.elemID, brand1),
              staticFiles: [
                {
                  filename: 'file1.txt',
                  content: Buffer.from('file1content'),
                },
                {
                  filename: 'fileWithReference.js',
                  content: Buffer.from('var PREFIX_123 = url'),
                },
              ],
            },
            expect.anything(),
          )
          expect(mockPublish).not.toHaveBeenCalled()
        })

        it('should publish the theme if live is true', async () => {
          const config = { ...DEFAULT_CONFIG }
          config[FETCH_CONFIG].guide = {
            brands: ['.*'],
            themes: {
              brands: ['.*'],
              referenceOptions: {
                enableReferenceLookup: false,
              },
            },
          }
          filter = filterCreator(
            createFilterCreatorParams({
              config,
              elementsSource: buildElementsSourceFromElements([themeSettingsInstance2]),
            }),
          )

          await filter.deploy?.(changes)
          expect(mockPublish).toHaveBeenCalledWith('newId', expect.anything())
        })
      })

      describe('with errors', () => {
        describe('theme id returned', () => {
          beforeEach(() => {
            mockCreate.mockResolvedValue({ themeId: 'idWithError', errors: ['create error'] })
          })

          it('should return the aggregated errors', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [{ elemID: newThemeWithFiles.elemID, message: 'create error', severity: 'Error' }],
              },
              leftoverChanges: [],
            })
          })

          it('should apply the new id', async () => {
            await filter.deploy?.(changes)
            expect((changes[0] as AdditionChange<InstanceElement>).data.after.value.id).toEqual('idWithError')
          })
        })

        describe('theme id not returned', () => {
          beforeEach(() => {
            mockCreate.mockResolvedValue({ themeId: undefined, errors: [] })
          })
          it('should not apply the change', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [
                  {
                    elemID: newThemeWithFiles.elemID,
                    message:
                      'Missing theme id from create theme response for theme zendesk.theme.instance.newThemeWithFiles',
                    severity: 'Error',
                  },
                ],
              },
              leftoverChanges: [],
            })
            expect((changes[0] as AdditionChange<InstanceElement>).data.after.value.id).toBeUndefined()
          })
        })
      })
    })

    describe('update theme', () => {
      let changes: Change<InstanceElement>[]

      beforeEach(() => {
        const before = newThemeWithFiles.clone()
        before.value.id = 'oldId'
        const after = newThemeWithFiles.clone()
        after.value.root.files['file1_txt@v'] = {
          filename: 'file1.txt',
          content: Buffer.from('newContent'),
        }
        changes = [toChange({ before, after })]
      })

      describe('with no errors', () => {
        beforeEach(() => {
          mockCreate.mockResolvedValue({ themeId: 'newId', errors: [] })
          mockDelete.mockResolvedValue([])
          mockPublish.mockResolvedValue([])
        })

        it('should apply the change and return no errors', async () => {
          expect(await filter.deploy?.(changes)).toEqual({
            deployResult: { appliedChanges: changes, errors: [] },
            leftoverChanges: [],
          })
          expect((changes[0] as ModificationChange<InstanceElement>).data.after.value.id).toEqual('newId')
          expect(mockCreate).toHaveBeenCalledWith(
            {
              brandId: new ReferenceExpression(brand1.elemID, brand1),
              staticFiles: [
                {
                  filename: 'file1.txt',
                  content: Buffer.from('newContent'),
                },
                {
                  filename: 'fileWithReference.js',
                  content: Buffer.from('var PREFIX_123 = url'),
                },
              ],
            },
            expect.anything(),
          )
          expect(mockDelete).toHaveBeenCalledWith('oldId', expect.anything())
          expect(mockPublish).not.toHaveBeenCalled()
        })

        it('should publish the theme if live is true', async () => {
          const config = { ...DEFAULT_CONFIG }
          config[FETCH_CONFIG].guide = {
            brands: ['.*'],
            themes: {
              brands: ['.*'],
              referenceOptions: {
                enableReferenceLookup: false,
              },
            },
          }
          filter = filterCreator(
            createFilterCreatorParams({
              config,
              elementsSource: buildElementsSourceFromElements([themeSettingsInstance2]),
            }),
          )
          await filter.deploy?.(changes)
          expect(mockPublish).toHaveBeenCalledWith('newId', expect.anything())
        })
      })

      describe('with errors', () => {
        describe('theme id returned', () => {
          beforeEach(() => {
            mockCreate.mockResolvedValue({ themeId: 'idWithError', errors: ['create error'] })
          })

          it('should return the aggregated errors', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [{ elemID: newThemeWithFiles.elemID, message: 'create error', severity: 'Error' }],
              },
              leftoverChanges: [],
            })
            expect(mockDelete).not.toHaveBeenCalled()
          })

          it('should apply the new id', async () => {
            await filter.deploy?.(changes)
            expect((changes[0] as ModificationChange<InstanceElement>).data.after.value.id).toEqual('idWithError')
          })
        })
        describe('error only in publish', () => {
          beforeEach(() => {
            const config = { ...DEFAULT_CONFIG }
            config[FETCH_CONFIG].guide = {
              brands: ['.*'],
              themes: {
                brands: ['.*'],
                referenceOptions: {
                  enableReferenceLookup: false,
                },
              },
            }
            filter = filterCreator(
              createFilterCreatorParams({
                config,
                elementsSource: buildElementsSourceFromElements([themeSettingsInstance2]),
              }),
            )
            mockPublish.mockResolvedValue(['Failed to publish'])
            mockCreate.mockResolvedValue({ themeId: 'idWithError', errors: [] })
          })

          it('should return an addition to the publish error in case of failure', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [
                  {
                    elemID: newThemeWithFiles.elemID,
                    message:
                      'Failed to publish. The theme has been created but not published; you can manually publish it in the Zendesk UI.',
                    severity: 'Error',
                  },
                ],
              },
              leftoverChanges: [],
            })
            expect(mockDelete).not.toHaveBeenCalled()
          })
        })

        describe('theme id not returned', () => {
          beforeEach(() => {
            mockCreate.mockResolvedValue({ themeId: undefined, errors: [] })
          })
          it('should not apply the change', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [
                  {
                    elemID: newThemeWithFiles.elemID,
                    message:
                      'Missing theme id from create theme response for theme zendesk.theme.instance.newThemeWithFiles',
                    severity: 'Error',
                  },
                ],
              },
              leftoverChanges: [],
            })
            expect((changes[0] as ModificationChange<InstanceElement>).data.after.value.id).toBeUndefined()
          })
        })

        describe('delete theme fails', () => {
          beforeEach(() => {
            mockCreate.mockResolvedValue({ themeId: 'idWithError', errors: [] })
            mockDelete.mockResolvedValue(['delete error'])
          })

          it('should return the aggregated errors', async () => {
            expect(await filter.deploy?.(changes)).toEqual({
              deployResult: {
                appliedChanges: [],
                errors: [{ elemID: newThemeWithFiles.elemID, message: 'delete error', severity: 'Error' }],
              },
              leftoverChanges: [],
            })
          })
        })
      })
    })
  })
})
