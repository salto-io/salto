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
import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
// eslint-disable-next-line
import { toInstance } from '../../../src/elements/ducktype'
import { RECORDS_PATH } from '../../../src/elements'

/* eslint-disable @typescript-eslint/camelcase */
const ADAPTER_NAME = 'myAdapter'

const type = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'bla'), fields: {} })

describe('ducktype_instance_elements', () => {
  describe('toInstance', () => {
    const entry = {
      id: 54775,
      api_collection_id: 22,
      flow_id: 890,
      name: 'some other name',
      field_with_complex_type: {
        number: 53,
        nested_type: {
          val: 'agds',
          another_val: 'dgadgasg',
        },
      },
    }
    it('should generate instance based on response', () => {
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(
        'some_other_name@s',
        type,
        entry,
      ))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'some_other_name'])
    })
    it('should omit fields from the top level', () => {
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        pathField: 'name',
        defaultName: 'abc',
        entry,
        fieldsToOmit: ['field_with_complex_type', 'id'],
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(
        'some_other_name@s',
        type,
        _.omit(entry, 'field_with_complex_type', 'id'),
      ))).toBeTruthy()
      expect(inst?.isEqual(new InstanceElement(
        'some_other_name@s',
        type,
        entry,
      ))).toBeFalsy()
    })
    it('should use default name if name field is not found in entry', () => {
      const e = _.omit(entry, 'name')
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        defaultName: 'abc',
        entry: e,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(
        'abc',
        type,
        e,
      ))).toBeTruthy()
    })
    it('should not omit nested fields', () => {
      const e = {
        field_with_complex_type: {
          id: 54775,
          number: 53,
        },
      }
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        defaultName: 'abc',
        entry: {
          id: 54775,
          ...e,
        },
        fieldsToOmit: ['id'],
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(
        'abc',
        type,
        e,
      ))).toBeTruthy()
    })
    it('should omit null field values', () => {
      const e = {
        a: null,
        field_with_complex_type: {
          id: 54775,
          number: 53,
          null: null,
        },
      }
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        defaultName: 'abc',
        entry: e,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(
        'abc',
        type,
        {
          field_with_complex_type: {
            id: 54775,
            number: 53,
          },
        },
      ))).toBeTruthy()
    })
    it('should not generate instance if value is empty', () => {
      const inst = toInstance({
        adapterName: ADAPTER_NAME,
        type,
        nameField: 'name',
        defaultName: 'abc',
        entry: {},
      })
      expect(inst).toBeUndefined()
    })
  })
})
