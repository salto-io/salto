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
import { ObjectType, ElemID, InstanceElement, Element, BuiltinTypes } from '@salto-io/adapter-api'
import { TypeDuckTypeConfig, TypeDuckTypeDefaultsConfig } from '../../../src/config_deprecated'
import { addRemainingTypes } from '../../../src/elements_deprecated/ducktype/add_remaining_types'

const ADAPTER_NAME = 'myAdapter'

describe('add remaining types', () => {
  const typeDefaultConfig: TypeDuckTypeDefaultsConfig = { transformation: { idFields: ['name'] } }
  const typesConfig: Record<string, TypeDuckTypeConfig> = {
    folder: {
      request: {
        url: '/folders',
      },
      transformation: {
        idFields: ['name'],
        standaloneFields: [{ fieldName: 'subfolders' }],
        sourceTypeName: 'dir',
      },
    },
    file: {
      request: {
        url: '/files',
        dependsOn: [
          // id doesn't actually exist in the url so this configuration is not realistic
          { pathParam: 'id', from: { type: 'folder', field: 'id' } },
        ],
      },
    },
    permission: {
      request: {
        url: '/permissions',
        queryParams: {
          folderId: 'abc',
        },
      },
      transformation: {
        dataField: '.',
      },
    },
    workflow: {
      request: {
        url: '/workflows',
      },
      transformation: {
        standaloneFields: [{ fieldName: 'flows' }],
      },
    },
    subfolders: {
      transformation: {
        sourceTypeName: 'folder__subfolders',
        dataField: 'value',
      },
    },
  }
  const supportedTypes = {
    dir: ['dir'],
    file: ['file'],
    permission: ['permission'],
    workflow: ['workflow'],
  }
  it('should create all the needed types if elements exist', () => {
    const elements: Element[] = []
    addRemainingTypes({
      elements,
      typesConfig,
      adapterName: ADAPTER_NAME,
      supportedTypes,
      typeDefaultConfig,
    })
    expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
      'myAdapter.file',
      'myAdapter.folder',
      'myAdapter.permission',
      'myAdapter.subfolders',
      'myAdapter.subfolders__value',
      'myAdapter.workflow',
      'myAdapter.workflow__flows',
    ])
  })
  it('should not remove existing types and instances', () => {
    const fileType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'file'),
      fields: { test: { refType: BuiltinTypes.STRING } },
    })
    const fileInstance = new InstanceElement('file1', fileType, { test: 'test1' })
    const elements = [fileType, fileInstance]
    addRemainingTypes({
      elements,
      typesConfig,
      adapterName: ADAPTER_NAME,
      supportedTypes,
      typeDefaultConfig,
    })
    expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
      'myAdapter.file',
      'myAdapter.file.instance.file1',
      'myAdapter.folder',
      'myAdapter.permission',
      'myAdapter.subfolders',
      'myAdapter.subfolders__value',
      'myAdapter.workflow',
      'myAdapter.workflow__flows',
    ])
    expect(elements.find(e => e.elemID.getFullName() === 'myAdapter.file')).toEqual(fileType)
    expect(elements.find(e => e.elemID.getFullName() === 'myAdapter.file.instance.file1')).toEqual(fileInstance)
  })
})
