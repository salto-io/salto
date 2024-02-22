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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import configChangesValidator from '../../src/change_validators/config_changes'

describe('config elements changes validator', () => {
  const type = new ObjectType({
    elemID: new ElemID(NETSUITE, 'a'),
    fields: {
      field: {
        refType: BuiltinTypes.BOOLEAN,
      },
    },
  })
  const before = new InstanceElement(ElemID.CONFIG_NAME, type, {
    field: false,
  })
  let after: InstanceElement
  beforeEach(() => {
    after = before.clone()
  })

  it('should return errors on instance addition/removal', async () => {
    const result = await configChangesValidator([toChange({ before }), toChange({ after })])
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      elemID: after.elemID,
      severity: 'Error',
      message: "Can't deploy an addition or a removal of a Settings instance",
      detailedMessage:
        'Addition or removal of a Settings instance is not supported. You can only modify this instance and edit the value of specific fields in it.',
    })
    expect(result[1]).toEqual(result[0])
  })
  it('should return warnings/errors on values addition/removal', async () => {
    after.value = { changed: true }
    const result = await configChangesValidator([toChange({ before, after })])
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      elemID: after.elemID.createNestedID('field'),
      severity: 'Error',
      message: "Can't deploy removal of values in a Settings instance",
      detailedMessage:
        'Removal of values in a Settings instance is not supported. You can only add or modify these values.',
    })
    expect(result[1]).toEqual({
      elemID: after.elemID.createNestedID('changed'),
      severity: 'Warning',
      message: 'Addition of values in a Settings instance may be ignored by NetSuite',
      detailedMessage:
        'Addition of values in a Settings instance may be ignored by NetSuite. In such a case these additions will be deleted in Salto in the next fetch.\n' +
        'Consider doing this change directly in the NetSuite UI.',
    })
  })
})
