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
import _ from 'lodash'
import { FileProperties } from 'jsforce-types'
import { MockInterface } from '@salto-io/test-utils'
import {
  ElemID,
  InstanceElement,
} from '@salto-io/adapter-api'
import Connection from '../src/client/jsforce'
import createMockClient from './client'
import { retrieveMetadataInstances } from '../src/fetch'
import { mockTypes } from './mock_elements'
import {
  CUSTOM_OBJECT,
  DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
  SALESFORCE,
} from '../src/constants'
import SalesforceClient from '../src/client/client'
import { buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import {
  mockFileProperties,
  mockRetrieveLocator,
  mockRetrieveResult,
} from './connection'
import { ZipFile } from './utils'
import { MetadataObjectType } from '../src/transformers/transformer'

describe('Fetch via retrieve API', () => {
  let connection: MockInterface<Connection>
  let client: SalesforceClient

  type MockInstanceDef = {
    type: MetadataObjectType
    instanceName: string
  }

  const updateProfileZipFileContents = (zipFile: ZipFile, fileProps: FileProperties[]): void => {
    const customObjectTypes = [...new Set(fileProps
      .filter(fileProp => fileProp.type === CUSTOM_OBJECT)
      .map(fileProp => fileProp.fullName))]
    zipFile.content = `<?xml version="1.0" encoding="UTF-8"?>
          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
              <custom>false</custom>`
    customObjectTypes.forEach(type => {
      zipFile.content += `<fieldPermissions>
        <editable>true</editable>
        <field>${type}.SomeField</field>
        <readable>true</readable>
    </fieldPermissions>`
    })
    zipFile.content += '</Profile>'
  }

  const createFilePath = (fileName: string, type: MetadataObjectType): string => (
    `unpackaged/${fileName}${type.annotations.hasMetaFile ? '-meta.xml' : ''}`
  )

  const generateMockData = (instanceDefs: MockInstanceDef[]): { fileProps: FileProperties[]; zipFiles: ZipFile[] } => {
    const fileProps = instanceDefs
      .map(({ type, instanceName }) => mockFileProperties({ type: type.elemID.typeName, fullName: instanceName }))

    const zipFiles = _.zip(fileProps, instanceDefs)
      .map(([fileProp, instanceDef]) => {
        if (fileProp === undefined || instanceDef === undefined) {
          // can't happen
          return { path: '', content: '' }
        }
        return {
          path: createFilePath(fileProp.fileName, instanceDef.type),
          content: `<?xml version="1.0" encoding="UTF-8"?>
          <${fileProp.type} xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
          </${fileProp.type}>`,
        }
      })
    return {
      fileProps,
      zipFiles,
    }
  }

  const setupMocks = async (mockDefs: MockInstanceDef[]): Promise<void> => {
    const { fileProps, zipFiles } = generateMockData(mockDefs)
    connection.metadata.list.mockImplementation(async inputQueries => {
      const queries = Array.isArray(inputQueries) ? inputQueries : [inputQueries]
      return _(queries)
        .map(query => fileProps.filter(fileProp => fileProp.type === query.type))
        .flatten()
        .value()
    })
    zipFiles
      .filter(zipFile => zipFile.content.includes('</Profile>'))
      .forEach(zipFile => updateProfileZipFileContents(zipFile, fileProps))
    connection.metadata.retrieve.mockReturnValue(mockRetrieveLocator(mockRetrieveResult({ zipFiles })))
  }

  beforeEach(async () => {
    ({ connection, client } = createMockClient())
  })

  describe('Single regular instance', () => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([{ type: mockTypes.ApexClass, instanceName: 'SomeApexClass' }])

      elements = (await retrieveMetadataInstances(
        {
          client,
          types: [mockTypes.ApexClass],
          maxItemsInRetrieveRequest: DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
          metadataQuery: buildMetadataQuery({}),
          addNamespacePrefixToFullName: false,
          typesToSkip: new Set(),
        }
      )
      ).elements
    })

    it('should fetch the correct instances', () => {
      expect(elements).toHaveLength(1)
      expect(elements[0].elemID).toEqual(new ElemID(SALESFORCE, 'ApexClass', 'instance', 'SomeApexClass'))
    })
  })

  describe.each([
    DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    1,
  ])('Chunks of regular instances [chunk size = $chunkSize]', chunkSize => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([
        { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
      ])

      elements = (await retrieveMetadataInstances(
        {
          client,
          types: [mockTypes.ApexClass, mockTypes.CustomObject],
          maxItemsInRetrieveRequest: chunkSize,
          metadataQuery: buildMetadataQuery({}),
          addNamespacePrefixToFullName: false,
          typesToSkip: new Set(),
        }
      )
      ).elements
    })

    it('should fetch the correct instances', () => {
      expect(elements).toHaveLength(2)
      expect(elements).toIncludeAllPartialMembers([
        { elemID: new ElemID(SALESFORCE, 'ApexClass', 'instance', 'SomeApexClass') },
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Account') },
      ])
    })
  })

  describe.each([
    DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    2,
  ])('chunks with one profile [chunk size = %d]', chunkSize => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
      ])

      elements = (await retrieveMetadataInstances(
        {
          client,
          types: [mockTypes.CustomObject, mockTypes.Profile],
          maxItemsInRetrieveRequest: chunkSize,
          metadataQuery: buildMetadataQuery({}),
          addNamespacePrefixToFullName: false,
          typesToSkip: new Set(),
        }
      )
      ).elements
    })

    it('should fetch the correct instances including a complete profile', () => {
      expect(elements).toHaveLength(3)
      expect(elements).toIncludeAllPartialMembers([
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Case') },
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Account') },
        { elemID: new ElemID(SALESFORCE, 'Profile', 'instance', 'SomeProfile') },
      ])
      const profileInstance = elements[2]
      expect(profileInstance.value.fieldPermissions).not.toBeEmpty()
      const referencedTypes = _(profileInstance.value.fieldPermissions)
        .map(({ field }: { field: string }) => field.split('.')[0])
        .sortBy()
        .value()

      expect(referencedTypes).toEqual(['Account', 'Case'])
    })
  })


  describe('Multiple chunks with multiple profiles', () => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      await setupMocks([
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
        { type: mockTypes.Profile, instanceName: 'SomeOtherProfile' },
      ])

      elements = (await retrieveMetadataInstances(
        {
          client,
          types: [mockTypes.CustomObject, mockTypes.Profile],
          maxItemsInRetrieveRequest: 3,
          metadataQuery: buildMetadataQuery({}),
          addNamespacePrefixToFullName: false,
          typesToSkip: new Set(),
        }
      )
      ).elements
    })

    it('should fetch the correct instances including both complete profiles', () => {
      expect(elements).toHaveLength(4)
      expect(elements).toIncludeAllPartialMembers([
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Case') },
        { elemID: new ElemID(SALESFORCE, 'CustomObject', 'instance', 'Account') },
        { elemID: new ElemID(SALESFORCE, 'Profile', 'instance', 'SomeProfile') },
        { elemID: new ElemID(SALESFORCE, 'Profile', 'instance', 'SomeOtherProfile') },
      ])
      const profileInstances = elements.slice(2)
      profileInstances.forEach(profileInstance => {
        expect(profileInstance.value.fieldPermissions).not.toBeEmpty()
        const referencedTypes = _(profileInstance.value.fieldPermissions)
          .map(({ field }: { field: string }) => field.split('.')[0])
          .sortBy()
          .value()
        expect(referencedTypes).toEqual(['Account', 'Case'])
      })
    })
  })
})
