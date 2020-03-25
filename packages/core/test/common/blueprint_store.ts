/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { DirectoryStore, File } from 'src/workspace/dir_store'
import { ParseResultCache } from 'src/workspace/cache'

const workspaceFiles = {
  'file.bp': `
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
number not_a_list_yet_field {

}
salesforce.text empty {}
}

type salesforce.WithAnnotationsBlock {
  annotations {
    string firstAnnotation {
    }
  }
}

type multi.loc { a = 1 }
type one.liner { a = 1 }`,
  'subdir/file.bp': `
type salesforce.lead {
salesforce.text ext_field {
  ${CORE_ANNOTATIONS.DEFAULT} = "foo"
}
}
type multi.loc { b = 1 }`,

  'error.bp': 'invalid syntax }}',

  'dup.bp': `
type salesforce.lead {
string base_field {}
}`,

  'willbempty.bp': 'type nonempty { a = 2 }',
}

const bps: Record<string, File> = _.mapValues(workspaceFiles,
  (buffer, filename) => ({ filename, buffer }))

export const mockBpsStore = (exclude: string[] = ['error.bp', 'dup.bp']): DirectoryStore => (
  {
    list: jest.fn().mockResolvedValue(Object.keys(bps).filter(name => !exclude.includes(name))),
    get: jest.fn().mockImplementation((filename: string) => Promise.resolve(bps[filename])),
    set: jest.fn().mockImplementation(() => Promise.resolve()),
    delete: jest.fn().mockImplementation(() => Promise.resolve()),
    flush: jest.fn().mockImplementation(() => Promise.resolve()),
    mtimestamp: jest.fn(),
    getFiles: jest.fn().mockImplementation((filenames: string[]) =>
      Promise.resolve(filenames.map(f => bps[f]))),
    clone: () => mockBpsStore(exclude),
  }
)

export const mockParseCache = (): ParseResultCache => ({
  put: () => Promise.resolve(),
  get: () => Promise.resolve(undefined),
  flush: () => Promise.resolve(undefined),
  clone: () => mockParseCache(),
})
