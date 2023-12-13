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

import {
  Change,
  ChangeGroupIdFunction,
  ChangeGroupIdFunctionReturn,
  ElemID,
  InstanceElement,
  ObjectType,
  toChange
} from '@salto-io/adapter-api'
import {getCustomGroupIds, mergeChangeGroupInfo} from '../../../src/core/plan/group'
import {DataNodeMap} from "@salto-io/dag";

describe('group', () => {
  describe('mergeChangeGroupInfo', () => {
    it('should do nothing for a single group info', () => {
      const groupInfo: ChangeGroupIdFunctionReturn = { changeGroupIdMap: new Map(), disjointGroups: new Set('abc') }
      expect(mergeChangeGroupInfo([groupInfo])).toMatchObject({
        disjointGroups: new Set('abc'),
      })
    })
    it('should correcly merge several group infos', () => {
      const groups1 = { changeGroupIdMap: new Map([['A', 'A1'], ['B', 'B1']]), disjointGroups: new Set('a') }
      const groups2 = { changeGroupIdMap: new Map([['C', 'C1']]), disjointGroups: new Set('bcd') }
      const groups3 = { changeGroupIdMap: new Map(), disjointGroups: new Set('be') }
      const groups4 = { changeGroupIdMap: new Map() }

      expect(mergeChangeGroupInfo([groups1, groups2, groups3, groups4])).toMatchObject({
        changeGroupIdMap: new Map([['A', 'A1'], ['B', 'B1'], ['C', 'C1']]),
        disjointGroups: new Set('abcde'),
      })
    })
  })
  describe('getCustomGroupIds', () => {
    let changesMap: DataNodeMap<Change>
    let customGroupIdFunctions: Record<string, ChangeGroupIdFunction>
    beforeEach(() => {
      const account1Type = new ObjectType({elemID: new ElemID('account1', 'Type')})
      const account2Type = new ObjectType({elemID: new ElemID('account2', 'Type')})
      const account1Instance = new InstanceElement('InstanceName', account1Type, {})
      const account2Instance = new InstanceElement('InstanceName', account2Type, {})
      const account1Change = toChange({after: account1Instance})
      const account2Change = toChange({after: account2Instance})

      changesMap = new DataNodeMap<Change>()
      changesMap.addNode('account1', [], account1Change)
      changesMap.addNode('account2', [], account2Change)

      customGroupIdFunctions = {
        account1: async () => ({
          changeGroupIdMap: new Map([[account1Instance.elemID.getFullName(), 'customKey']]),
          disjointGroups: new Set(['customKey'])
        }),
        account2: async () => ({
          changeGroupIdMap: new Map([[account2Instance.elemID.getFullName(), 'customKey']]),
          disjointGroups: new Set(['customKey'])
        }),
      }
    })
    it('should append the account name suffix to the custom group ids', async () => {
      const {changeGroupIdMap, disjointGroups} = await getCustomGroupIds(changesMap, customGroupIdFunctions)
      expect(changeGroupIdMap.size).toEqual(2)
      expect(changeGroupIdMap.get('account1.Type.instance.InstanceName')).toEqual('account1__customKey')
      expect(changeGroupIdMap.get('account2.Type.instance.InstanceName')).toEqual('account2__customKey')
      expect(disjointGroups).toEqual(new Set(['account1__customKey', 'account2__customKey']))
    })
  })
})

