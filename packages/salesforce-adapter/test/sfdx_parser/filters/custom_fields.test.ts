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
import { readTextFile } from '@salto-io/file'
import { InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import customFieldsFilter from '../../../src/sfdx_parser/filters/custom_fields'
import { createCustomObjectType, defaultFilterContext } from '../../utils'
import { mockTypes } from '../../mock_elements'
import {
  createInstanceElement,
  Types,
} from '../../../src/transformers/transformer'
import { FilterContext } from '../../../src/filter'
import { FIELD_ANNOTATIONS } from '../../../src/constants'

jest.mock('@salto-io/file', () => {
  const actual = jest.requireActual('@salto-io/file')
  const fileNotFoundError = new Error('File not found') as Error & {
    code: string
  }
  fileNotFoundError.code = 'ENOENT'
  const mockReadTextFile = jest.fn().mockRejectedValue(fileNotFoundError)
  ;(mockReadTextFile as unknown as typeof readTextFile).notFoundAsUndefined =
    jest.fn().mockResolvedValue(undefined)
  return {
    ...actual,
    readTextFile: mockReadTextFile,
  }
})

describe('custom fields filter', () => {
  const mockFiles: Record<string, string> = {
    'pkg/app/type/obj__c/fields/MyField__c.field-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>MyField__c</fullName>
        <defaultValue>false</defaultValue>
        <description>desc</description>
        <label>Check</label>
        <type>Checkbox</type>
    </CustomField>
    `,
    'pkg/app/type/obj__c/fields/SecondField__c.field-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>SecondField__c</fullName>
        <defaultValue>false</defaultValue>
        <description>omg</description>
        <label>Second</label>
        <type>Checkbox</type>
    </CustomField>
    `,
    'pkg/app/type/other_obj__c/fields/OtherField__c.field-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>OtherField__c</fullName>
        <defaultValue>false</defaultValue>
        <label>Check</label>
        <type>Checkbox</type>
    </CustomField>
    `,
    'pkg/app/type/not_a_field.obj-meta.xml': '',
  }

  let filter: ReturnType<typeof customFieldsFilter>
  beforeEach(() => {
    // eslint-disable-next-line max-len
    const readTextFileMock =
      readTextFile.notFoundAsUndefined as jest.MockedFunction<
        typeof readTextFile.notFoundAsUndefined
      >
    readTextFileMock.mockImplementation(async (filename) => mockFiles[filename])
    const existingCustomObjectType = createCustomObjectType('obj__c', {
      fields: {
        MyField__c: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [FIELD_ANNOTATIONS.CREATABLE]: false,
            [FIELD_ANNOTATIONS.UPDATEABLE]: false,
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
          },
        },
      },
    })
    const config: FilterContext = {
      ...defaultFilterContext,
      elementsSource: buildElementsSourceFromElements([
        existingCustomObjectType,
      ]),
    }
    filter = customFieldsFilter({
      config,
      files: {
        baseDirName: '',
        sourceFileNames: Object.keys(mockFiles).concat(
          'pkg/app/type/obj/fields/NoSuchFile__c.field-meta.xml',
        ),
        staticFileNames: [],
      },
    })
  })
  describe('when called with custom object instances', () => {
    let elements: InstanceElement[]
    beforeEach(async () => {
      elements = [
        createInstanceElement({ fullName: 'obj__c' }, mockTypes.CustomObject),
      ]
      await filter.onFetch?.(elements)
    })
    it('should add fields to the custom object that exists', () => {
      expect(elements[0].value.fields).toBeDefined()
      expect(elements[0].value.fields).toContainEqual(
        expect.objectContaining({ fullName: 'MyField__c' }),
      )
      expect(elements[0].value.fields).toContainEqual(
        expect.objectContaining({ fullName: 'SecondField__c' }),
      )
    })
    it('should maintain field annotations for fields that exist in the element source', () => {
      expect(elements[0].value.fields).toContainEqual(
        expect.objectContaining({
          fullName: 'MyField__c',
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        }),
      )
    })
    it('should set field annotations to true for fields that do not exist in the element source', () => {
      expect(elements[0].value.fields).toContainEqual(
        expect.objectContaining({
          fullName: 'SecondField__c',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        }),
      )
    })
    it('should not add fields from other objects', () => {
      expect(elements[0].value.fields).toBeDefined()
      expect(elements[0].value.fields).not.toContainEqual(
        expect.objectContaining({ fullName: 'OtherField__c' }),
      )
    })
  })
})
