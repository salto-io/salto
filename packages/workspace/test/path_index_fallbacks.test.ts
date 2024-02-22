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
import { ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { Workspace } from '../src/workspace/workspace'
import { mockDirStore } from './common/nacl_file_store'
import { createWorkspace } from './common/workspace'
import { createPathIndexForElement } from '../src/path_index_fallbacks'

const { awu } = collections.asynciterable

describe('createPathIndexForElement', () => {
  let workspace: Workspace
  const firstFile = `
    type salesforce.text is string {}
    type salesforce.lead {
      salesforce.text singleDef {

      }
      salesforce.text multiDef {

      }
    }
  `
  const secondFile = `
    type salesforce.lead {
      salesforce.text multiDef {

      }
    }
  `

  const redHeringFile = `
    type salesforce.hearing {
      salesforce.text multiDef {

      }
    }
  `
  const naclFileStore = mockDirStore(undefined, undefined, {
    'firstFile.nacl': firstFile,
    'secondFile.nacl': secondFile,
    'redHeringFile.nacl': redHeringFile,
  })

  const expected = [
    { key: 'salesforce.lead', value: [['firstFile'], ['secondFile']] },
    { key: 'salesforce.lead.field', value: [['firstFile'], ['secondFile']] },
    { key: 'salesforce.lead.field.multiDef', value: [['firstFile'], ['secondFile']] },
    { key: 'salesforce.lead.field.singleDef', value: [['firstFile']] },
  ]

  beforeAll(async () => {
    workspace = await createWorkspace(naclFileStore)
  })
  it('should create path index for a top level id', async () => {
    const id = ElemID.fromFullName('salesforce.lead')
    const res = await awu((await createPathIndexForElement(workspace, id)).entries()).toArray()
    expect(res).toHaveLength(expected.length)
    expect(res).toEqual(expect.arrayContaining(expected))
  })
  it('should create the same path index for a nested id', async () => {
    const id = ElemID.fromFullName('salesforce.lead.field.singleDef')
    const res = await awu((await createPathIndexForElement(workspace, id)).entries()).toArray()
    expect(res).toHaveLength(expected.length)
    expect(res).toEqual(expect.arrayContaining(expected))
  })
})
