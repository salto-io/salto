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
import { InstanceElement } from '@salto-io/adapter-api'
import { parse } from '../parser/parse'
import { dumpElements } from '../parser/dump'
import { BP_EXTENSION } from './blueprints/blueprints_source'
import { DirectoryStore } from './dir_store'

export interface ConfigSource {
  get(name: string): Promise<InstanceElement | undefined>
  set(name: string, config: Readonly<InstanceElement>): Promise<void>
}

export const adapterConfig = (
  dirStore: DirectoryStore,
): ConfigSource => {
  const filename = (adapter: string): string => adapter.concat(BP_EXTENSION)

  return {
    get: async (adapter: string): Promise<InstanceElement | undefined> => {
      const bp = await dirStore.get(filename(adapter))
      return bp
        ? parse(Buffer.from(bp.buffer), bp.filename).elements.pop() as InstanceElement
        : undefined
    },

    set: async (adapter: string, config: InstanceElement): Promise<void> => {
      await dirStore.set({ filename: filename(adapter), buffer: dumpElements([config]) })
      await dirStore.flush()
    },
  }
}
