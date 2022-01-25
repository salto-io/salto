/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_identifiers'
import { NETSUITE } from '../../src/constants'
import { IDENTIFIER_FIELD } from '../../src/data_elements/types'

describe('data_instances_identifiers', () => {
  it('should remove identifier field', async () => {
    const accountType = new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } })
    const accountInstance = new InstanceElement('instance', accountType, { [IDENTIFIER_FIELD]: 'someValue' })
    await filterCreator().preDeploy?.([
      toChange({ after: accountInstance }),
    ])
    expect(accountInstance.value[IDENTIFIER_FIELD]).toBeUndefined()
  })
})
