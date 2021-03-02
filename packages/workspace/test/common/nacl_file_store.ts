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
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import _ from 'lodash'
import { DirectoryStore, File } from '../../src/workspace/dir_store'
import { ParsedNaclFileCache } from '../../src/workspace/nacl_files/parsed_nacl_files_cache'

const workspaceFiles = {
  'file.nacl': `
type salesforce.lead {
  salesforce.text base_field {
    ${CORE_ANNOTATIONS.DEFAULT} = "asd"
  }
  "List<number>" list_field {
    ${CORE_ANNOTATIONS.DEFAULT} = [
      1,
      2,
      3,
      4,
      5
    ]
  }

  number not_a_list_yet_field {}
  salesforce.text empty {}
}

type salesforce.text is string {}

type salesforce.AccountIntelligenceSettings {
  boolean enableAccountLogos {
  }
  boolean enableAutomatedAccountFields {
  }
  boolean enableNewsStories {
  }
}

type salesforce.WithAnnotationsBlock {
  annotations {
    string firstAnnotation {
    }
    hidden_string internalId {
    }
  }
}

type salesforce.WithoutAnnotationsBlock {
}

salesforce.WithoutAnnotationsBlock instWithoutAnnotationsBlock {
}

type salesforce.WithoutAnnotationsBlockListNested {
  "List<salesforce.WithoutAnnotationsBlock>" noAnno {
  }
}

type salesforce.ObjWithHidden {
  annotations {
    hidden_string internalId {
    }
  }
  number visible {
  }
  string hide {
    ${CORE_ANNOTATIONS.HIDDEN} = true
  }
  string hide_val {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
  number other {
  }
}

type salesforce.VisibleObjWithHidden {
  annotations {
    hidden_string internalId {
    }
  }
  number visible {
  }
  string hide {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
}

salesforce.ObjWithHidden instWithHidden {
  visible = 142
  other = 1
}

type salesforce.ObjWithNestedHidden {
  salesforce.ObjWithHidden nested {
  }
  salesforce.VisibleObjWithHidden nested_visible {
  }
  number other {
  }
}

salesforce.ObjWithNestedHidden instWithNestedHidden {
  other = 1
  nested_visible = {
    visible = 111
  }
}

type salesforce.ObjWithComplexHidden {
  salesforce.ObjWithHidden nested {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
  number other {
  }
}

salesforce.ObjWithComplexHidden instWithComplexHidden {
  other = 1
}

type salesforce.ObjWithDoublyNestedHidden {
  salesforce.ObjWithNestedHidden doubleNest {
  }
  salesforce.ObjWithHidden singleNest {
  }
  number noNest {
  }
  salesforce.ObjWithNestedHidden doubleHiddenVal {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
}

salesforce.ObjWithDoublyNestedHidden instWithDoublyNestedHidden {
  noNest = 44
  singleNest = {
    other = 2
    visible = 333
  }
  doubleNest = {
    nested = {
      other = -3
      visible = 0
    }
  }
}

type salesforce.HiddenVal {
  ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  string something {
  }
  number somethingElse {
  }
}

type salesforce.HiddenToVisibleVal {
  ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  string something {
  }
  number somethingElse {
  }
}

type salesforce.NestedHiddenVal {
  annotations {
    salesforce.HiddenVal hidden_val_anno {
    }
    salesforce.HiddenToVisibleVal hidden_to_visible_anno {
    }
  }
  string visible_val {
  }
}

type multi.loc { a = 1 }
type one.liner { a = 1 }`,
  'subdir/file.nacl': `
type salesforce.lead {
  salesforce.text ext_field {
    ${CORE_ANNOTATIONS.DEFAULT} = "foo"
  }
}
type multi.loc { b = 1 }`,

  'error.nacl': '{{ invalid syntax }}',

  'reference_error.nacl': `
type some.type {
  string a {
  }
}

some.type instance {
  a = some.type.instance.notExists
}
`,

  'dup.nacl': `
type salesforce.lead {
  string base_field {}
}`,

  'willbempty.nacl': 'type nonempty { a = 2 }',
  'renamed_type.nacl': `type salesforce.RenamedType1 {
  }`,
}

export const mockDirStore = (
  exclude: string[] = ['error.nacl', 'dup.nacl', 'reference_error.nacl'],
  empty = false,
  files?: Record<string, string>,
):
  DirectoryStore<string> => {
  const naclFiles: Record<string, File<string>> = empty ? {} : _.mapValues(files ?? workspaceFiles,
    (buffer, filename) => ({ filename, buffer }))
  return {
    list: jest.fn()
      .mockImplementation(() => Object.keys(naclFiles).filter(name => !exclude.includes(name))),
    isEmpty: jest.fn().mockResolvedValue(Object.keys(naclFiles).length === 0),
    get: jest.fn().mockImplementation((filename: string) => Promise.resolve(naclFiles[filename])),
    set: jest.fn().mockImplementation((file: File<string>) => { naclFiles[file.filename] = file }),
    delete: jest.fn().mockImplementation((fileName: string) => { delete naclFiles[fileName] }),
    clear: jest.fn().mockImplementation(() => Promise.resolve()),
    rename: jest.fn().mockImplementation(() => Promise.resolve()),
    renameFile: jest.fn().mockImplementation(() => Promise.resolve()),
    flush: jest.fn().mockImplementation(() => Promise.resolve()),
    mtimestamp: jest.fn(),
    getFiles: jest.fn().mockImplementation((filenames: string[]) =>
      Promise.resolve(filenames.map(f => naclFiles[f]))),
    getTotalSize: jest.fn(),
    clone: () => mockDirStore(exclude),
    getFullPath: filename => filename,
  }
}

export const mockParseCache = (): ParsedNaclFileCache => ({
  put: () => Promise.resolve(),
  get: () => Promise.resolve(undefined),
  flush: () => Promise.resolve(undefined),
  clear: () => Promise.resolve(),
  rename: () => Promise.resolve(),
  clone: () => mockParseCache(),
  delete: () => Promise.resolve(),
  list: () => Promise.resolve([]),
  getAllErrors: () => Promise.resolve([]),
  hasValid: () => Promise.resolve(true),
})
