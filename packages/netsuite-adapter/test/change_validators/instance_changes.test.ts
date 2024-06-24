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
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import instanceChangesValidator from '../../src/change_validators/instance_changes'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'

describe('customization type change validator', () => {
  it('should have change error if custom type SCRIPT_ID has been modified', async () => {
    const after = entitycustomfieldType().type
    after.fields[SCRIPT_ID].annotate({ dummyKey: 'dummyValue' })
    const changeErrors = await instanceChangesValidator([toChange({ before: entitycustomfieldType().type, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })
  it('should not have change error if custom record type SCRIPT_ID has been modified', async () => {
    const before = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    const after = before.clone()
    after.annotate({ dummyKey: 'dummyValue' })
    expect(await instanceChangesValidator([toChange({ before, after })])).toHaveLength(0)
  })
})
