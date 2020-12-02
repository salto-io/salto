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
import { Element, ElemID } from '@salto-io/adapter-api'
import rocksdb from 'rocksdb'
import levelup from 'levelup'
import { serialization } from '@salto-io/workspace'
import toArray from 'stream-to-array'

const { serialize, deserialize } = serialization

type RemoteMap = {
  get: (key: ElemID) => Promise<Element>
  set: (key: ElemID, element: Element) => Promise<void>
  list: () => Promise<ElemID[]>
}

export const createRemoteMap = (namespace: string): RemoteMap => {
  const db = levelup(rocksdb(`/tmp/${namespace}`))
  return {
    get: async (key: ElemID): Promise<Element> =>
      ((await deserialize(await db.get(key.getFullName()) as string))[0]),
    set: async (key: ElemID, element: Element): Promise<void> => {
      (await db.put(key.getFullName(), serialize([element])))
    },
    list: async () => (await toArray(db.createKeyStream())).map(buff => ElemID
      .fromFullName(buff.toString())),
  }
}
