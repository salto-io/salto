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
import { InstanceElement, ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, StaticFile, ChangeError } from '@salto-io/adapter-api'
import jsonTypeValidator from '../../src/change_validators/json_type'

const invalidJSON = '{'
const validJSON = '{ "a": "bba" }'
const invalidJSONStaticFile = new StaticFile({ filepath: 'path', content: Buffer.from(invalidJSON) })
const validJSONStaticFile = new StaticFile({ filepath: 'path', content: Buffer.from(validJSON) })

describe('json type change validator', () => {
  let instance: InstanceElement
  let object: ObjectType
  let changeErrors: Readonly<ChangeError[]>
  beforeEach(() => {
    object = new ObjectType({
      elemID: new ElemID('hubspot', 'obj'),
      fields: { f: {
        type: BuiltinTypes.JSON,
        annotations: {
          name: 'f',
          _readOnly: false,
          [CORE_ANNOTATIONS.REQUIRED]: false,
        },
      } },
    })
    instance = new InstanceElement('instance', object, {})
  })

  describe('onAdd', () => {
    describe('valid json', () => {
      it('value is string', () => {
        instance.value.f = invalidJSON
      })

      it('value is static file (json content)', () => {
        instance.value.f = invalidJSONStaticFile
      })

      afterEach(async () => {
        changeErrors = await jsonTypeValidator.onAdd(instance)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })

    describe('invalid json', () => {
      it('value is string', () => {
        instance.value.f = validJSON
      })

      it('value is static file (json content)', () => {
        instance.value.f = validJSONStaticFile
      })

      afterEach(async () => {
        changeErrors = await jsonTypeValidator.onAdd(instance)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('onUpdate', () => {
    let after: InstanceElement
    beforeEach(() => {
      after = instance.clone()
    })

    describe('invalid json', () => {
      it('value is string', () => {
        after.value.f = invalidJSON
      })

      it('value is static file (json content)', () => {
        after.value.f = invalidJSONStaticFile
      })

      afterEach(async () => {
        changeErrors = await jsonTypeValidator.onUpdate([{
          action: 'modify',
          data: { after, before: instance },
        }])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })


    describe('valid json', () => {
      it('value is string', () => {
        after.value.f = validJSON
      })

      it('value is static file (json content)', () => {
        after.value.f = validJSONStaticFile
      })

      afterEach(async () => {
        changeErrors = await jsonTypeValidator.onUpdate([{
          action: 'modify',
          data: { after, before: instance },
        }])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
