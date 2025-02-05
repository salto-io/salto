/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  OBJECTS_DIR,
  convertToFeaturesXmlContent,
  convertToXmlContent,
  parseFeaturesXml,
  parseFileCabinetDir,
  parseObjectsDir,
  parseSdfProjectDir,
} from '../../src/client/sdf_parser'
import {
  MOCK_FEATURES_XML,
  MOCK_FILE_ATTRS_PATH,
  MOCK_FILE_PATH,
  MOCK_FILE_WITHOUT_ATTRIBUTES_PATH,
  MOCK_FOLDER_ATTRS_PATH,
  MOCK_TEMPLATE_CONTENT,
  OBJECTS_DIR_FILES,
  OBJECT_XML_WITH_CDATA_AND_INNER_XML,
  OBJECT_XML_WITH_HTML_CHARS,
  readFileMockFunction,
} from './mocks'

const readFileMock = jest.fn()
const existsMock = jest.fn()
jest.mock('@salto-io/file', () => ({
  readFile: jest.fn().mockImplementation((...args) => readFileMock(...args)),
  exists: jest.fn().mockImplementation((...args) => existsMock(...args)),
}))

const readdirpMock = jest.fn()
jest.mock('readdirp', () => ({
  promise: jest.fn().mockImplementation((...args) => readdirpMock(...args)),
}))

describe('sdf parser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    readFileMock.mockImplementation(path => readFileMockFunction(path))
    existsMock.mockResolvedValue(true)
    readdirpMock.mockImplementation(dirPath =>
      dirPath.endsWith(OBJECTS_DIR)
        ? OBJECTS_DIR_FILES.map(path => ({ path }))
        : [MOCK_FILE_PATH, MOCK_FILE_ATTRS_PATH, MOCK_FOLDER_ATTRS_PATH, MOCK_FILE_WITHOUT_ATTRIBUTES_PATH].map(
            path => ({ path: path.slice(1) }),
          ),
    )
  })
  describe('parseObjectsDir', () => {
    it('should parse', async () => {
      await expect(parseObjectsDir('/projectPath')).resolves.toEqual([
        {
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
          scriptId: 'a',
          typeName: 'addressForm',
          values: {
            '@_filename': 'a.xml',
          },
        },
        {
          scriptId: 'b',
          typeName: 'addressForm',
          values: {
            '@_filename': 'b.xml',
          },
        },
      ])
      expect(readFileMock).toHaveBeenCalledTimes(3)
      const files = OBJECTS_DIR_FILES
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/Objects/${files[0]}`)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/Objects/${files[1]}`)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/Objects/${files[2]}`)
    })
    it('should decode html chars', async () => {
      readdirpMock.mockResolvedValue([{ path: 'custentity_my_script_id.xml' }])
      readFileMock.mockResolvedValue(OBJECT_XML_WITH_HTML_CHARS)
      const parsed = await parseObjectsDir('objectsDir')
      expect(parsed).toEqual([
        {
          typeName: 'entitycustomfield',
          values: {
            '@_scriptid': 'custentity_my_script_id',
            // There is ZeroWidthSpace char between element and Name
            label: 'Golf & Co’Co element​Name',
          },
          scriptId: 'custentity_my_script_id',
        },
      ])
    })
    it('should parse CDATA', async () => {
      readdirpMock.mockResolvedValue([{ path: 'custworkbook_my_workbook.xml' }])
      readFileMock.mockResolvedValue(OBJECT_XML_WITH_CDATA_AND_INNER_XML)
      const parsed = await parseObjectsDir('objectsDir')
      expect(parsed).toEqual([
        {
          typeName: 'workbook',
          values: {
            '@_scriptid': 'my_workbook',
            name: 'My workbook',
            definition: [
              `<root>
<pivots type="array">
  <_ITEM_>
    <_T_>pivot</_T_>
    <scriptId>my_pivot</scriptId>
    <definition>&lt;root>&lt;version>1&lt;/version>&lt;/root></definition>
  </_ITEM_>
</pivots>
</root>`,
              'Another definition',
            ],
          },
          scriptId: 'custworkbook_my_workbook',
        },
      ])
    })
  })
  describe('parseFileCabinetDir', () => {
    it('should parse', async () => {
      const objects = await parseFileCabinetDir('/projectPath', [
        MOCK_FILE_PATH,
        MOCK_FILE_ATTRS_PATH,
        MOCK_FOLDER_ATTRS_PATH,
        MOCK_FILE_WITHOUT_ATTRIBUTES_PATH,
      ])
      expect(objects).toEqual(
        expect.arrayContaining([
          {
            fileContent: 'dummy file content',
            path: ['Templates', 'E-mail Templates', 'InnerFolder', 'content.html'],
            typeName: 'file',
            values: {
              description: 'file description',
            },
          },
          {
            path: ['Templates', 'E-mail Templates', 'InnerFolder'],
            typeName: 'folder',
            values: {
              description: 'folder description',
            },
          },
          {
            fileContent: 'console.log("Hello World!")',
            path: ['Templates', 'E-mail Templates', 'InnerFolder', 'test.js'],
            typeName: 'file',
            values: {
              availablewithoutlogin: 'F',
              bundleable: 'F',
              description: '',
              generateurltimestamp: 'F',
              hideinbundle: 'F',
              isinactive: 'F',
            },
          },
          {
            typeName: 'folder',
            values: {
              bundleable: 'F',
              description: '',
              isinactive: 'F',
              isprivate: 'F',
            },
            path: ['Templates'],
          },
          {
            typeName: 'folder',
            values: {
              bundleable: 'F',
              description: '',
              isinactive: 'F',
              isprivate: 'F',
            },
            path: ['Templates', 'E-mail Templates'],
          },
        ]),
      )
      expect(readFileMock).toHaveBeenCalledTimes(4)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/FileCabinet${MOCK_FILE_PATH}`)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/FileCabinet${MOCK_FILE_ATTRS_PATH}`)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/FileCabinet${MOCK_FOLDER_ATTRS_PATH}`)
      expect(readFileMock).toHaveBeenCalledWith(`/projectPath/src/FileCabinet${MOCK_FILE_WITHOUT_ATTRIBUTES_PATH}`)
    })
  })
  describe('parseFeaturesXml', () => {
    it('should parse', async () => {
      await expect(parseFeaturesXml('/projectPath')).resolves.toEqual({
        typeName: 'companyFeatures',
        values: {
          feature: [
            {
              id: 'SUITEAPPCONTROLCENTER',
              status: 'ENABLED',
            },
          ],
        },
      })
      expect(readFileMock).toHaveBeenCalledWith('/projectPath/src/AccountConfiguration/features.xml')
    })
    it('should return undefined when file does not exists', async () => {
      existsMock.mockResolvedValue(false)
      await expect(parseFeaturesXml('/projectPath')).resolves.toBeUndefined()
    })
  })
  describe('parseSdfProjectDir', () => {
    it('should parse', async () => {
      const parsedContent = await parseSdfProjectDir('/projectPath')
      expect(parsedContent).toEqual(
        expect.arrayContaining([
          {
            fileContent: MOCK_TEMPLATE_CONTENT,
            fileExtension: 'html',
            scriptId: 'a',
            typeName: 'addressForm',
            values: {
              '@_filename': 'a.xml',
            },
          },
          {
            scriptId: 'b',
            typeName: 'addressForm',
            values: {
              '@_filename': 'b.xml',
            },
          },
          {
            fileContent: 'dummy file content',
            path: ['Templates', 'E-mail Templates', 'InnerFolder', 'content.html'],
            typeName: 'file',
            values: {
              description: 'file description',
            },
          },
          {
            path: ['Templates', 'E-mail Templates', 'InnerFolder'],
            typeName: 'folder',
            values: {
              description: 'folder description',
            },
          },
          {
            typeName: 'companyFeatures',
            values: {
              feature: [
                {
                  id: 'SUITEAPPCONTROLCENTER',
                  status: 'ENABLED',
                },
              ],
            },
          },
          {
            fileContent: 'console.log("Hello World!")',
            path: ['Templates', 'E-mail Templates', 'InnerFolder', 'test.js'],
            typeName: 'file',
            values: {
              availablewithoutlogin: 'F',
              bundleable: 'F',
              description: '',
              generateurltimestamp: 'F',
              hideinbundle: 'F',
              isinactive: 'F',
            },
          },
          {
            typeName: 'folder',
            values: {
              bundleable: 'F',
              description: '',
              isinactive: 'F',
              isprivate: 'F',
            },
            path: ['Templates'],
          },
          {
            typeName: 'folder',
            values: {
              bundleable: 'F',
              description: '',
              isinactive: 'F',
              isprivate: 'F',
            },
            path: ['Templates', 'E-mail Templates'],
          },
        ]),
      )
    })
  })
  describe('convertToXmlContent', () => {
    it('should encode html chars', async () => {
      const custInfo = {
        typeName: 'entitycustomfield',
        values: {
          '@_scriptid': 'custentity_my_script_id',
          // There is ZeroWidthSpace char between element and Name
          label: 'Golf & Co’Co element​Name',
        },
        scriptId: 'custentity_my_script_id',
      }
      const xmlContent = convertToXmlContent(custInfo)
      // We use here === instead of expect.toEqual() since jest treats html encoding as equal to
      // the decoded value
      expect(xmlContent === OBJECT_XML_WITH_HTML_CHARS).toBeTruthy()
    })
  })
  describe('convertToFeaturesXmlContent', () => {
    it('should convert', () => {
      const featuresCustInfo = {
        typeName: 'companyFeatures',
        values: {
          feature: [
            {
              id: 'SUITEAPPCONTROLCENTER',
              status: 'ENABLED',
            },
          ],
        },
      }
      expect(convertToFeaturesXmlContent(featuresCustInfo)).toEqual(MOCK_FEATURES_XML)
    })
  })
})
