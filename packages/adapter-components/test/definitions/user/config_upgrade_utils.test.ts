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
import { BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'
import { createUserConfigType } from '../../../src/definitions/user'
import { updateDeprecatedConfig } from '../../../src/definitions/user/config_upgrade_utils'

describe('config upgrade utils', () => {
  describe('updateDeprecatedConfig', () => {
    const defaultConfig = {
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
        customFlag: true,
      },
    }
    const configType = createUserConfigType({
      adapterName: 'myAdapter',
      additionalFetchFields: { customFlag: { refType: BuiltinTypes.BOOLEAN } },
      defaultConfig,
    })
    describe('with no deprecated apiDefinitions', () => {
      const config = new InstanceElement('config', configType, {
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'typeB' }],
          customFlag: false,
        },
      })
      it('should return undefined', () => {
        const res = updateDeprecatedConfig(config)
        expect(res).toBeUndefined()
      })
    })
    describe('with deprecated apiDefinitions', () => {
      it('should convert elemID related transformation to elemID config from the new format', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
          },
          apiDefinitions: {
            types: {
              foo: {
                transformation: { idFields: ['name', 'status'] },
              },
              bar: {
                transformation: {
                  idFields: ['&id', 'name'],
                  extendsParentId: false,
                },
              },
              myType: {
                transformation: {
                  idFields: [],
                  extendsParentId: true,
                },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
              bar: {
                parts: [{ fieldName: 'id', isReference: true }, { fieldName: 'name' }],
                extendsParent: false,
              },
              myType: {
                parts: [],
                extendsParent: true,
              },
            },
          },
        })
        expect(res?.message).toEqual(
          'Elem ID customizations are now under `fetch.elemID`. The following changes will upgrade the deprecated definitions from `apiDefinitions` to the new location.',
        )
      })
      it('should remove any empty parts from apiDefinitions', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {},
            },
            types: {
              foo: {
                transformation: { idFields: ['name', 'status'] },
                request: {},
              },
              bar: {
                request: { recurseInto: [] }, // we're no cleaning empty arrays
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
            },
          },
          apiDefinitions: {
            types: {
              bar: {
                request: { recurseInto: [] },
              },
            },
          },
        })
      })
      it('should not remove non empty parts from apiDefinitions that are not elemID related', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {},
            },
            types: {
              foo: {
                transformation: { idFields: ['name', 'status'] },
              },
              bar: {
                request: { url: '/bars' },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
            },
          },
          apiDefinitions: {
            types: {
              bar: { request: { url: '/bars' } },
            },
          },
        })
      })
      it('should not return updated config if no elemID related definitions are found', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [],
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {},
            },
            types: {
              foo: {
                request: { url: '/foos' },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res).toBeUndefined()
      })
      it('should merge any existing elemID config if exists', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
            elemID: {
              test: {
                parts: [{ fieldName: 'name' }],
              },
              foo: {
                parts: [{ fieldName: 'name' }],
              },
            },
          },
          apiDefinitions: {
            types: {
              foo: {
                transformation: { idFields: ['name', 'status'] },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
            elemID: {
              test: {
                parts: [{ fieldName: 'name' }],
              },
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
            },
          },
        })
      })
    })
  })
})
