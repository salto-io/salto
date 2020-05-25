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
import { ChangeGroup, DeployResult, isInstanceChange, InstanceElement } from '@salto-io/adapter-api'

export type ChangeOperations = {
  add: (elem: InstanceElement) => Promise<InstanceElement>
  remove: (elem: InstanceElement) => Promise<void>
  update: (before: InstanceElement, after: InstanceElement) => Promise<InstanceElement>
}

export const deployInstance = async (
  operations: ChangeOperations, changes: ChangeGroup
): Promise<DeployResult> => {
  const change = changes.changes[0]
  if (!isInstanceChange(change)) {
    return {
      appliedChanges: [],
      errors: [new Error('Only instance changes supported')],
    }
  }
  try {
    if (change.action === 'add') {
      const after = await operations.add(change.data.after)
      return { appliedChanges: [{ ...change, data: { after } }], errors: [] }
    }
    if (change.action === 'remove') {
      await operations.remove(change.data.before)
      return { appliedChanges: [change], errors: [] }
    }
    const after = await operations.update(change.data.before, change.data.after)
    return { appliedChanges: [{ ...change, data: { ...change.data, after } }], errors: [] }
  } catch (e) {
    return { appliedChanges: [], errors: [e] }
  }
}
