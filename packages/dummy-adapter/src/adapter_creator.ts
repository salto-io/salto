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
import { Adapter, ElemID, CORE_ANNOTATIONS, BuiltinTypes, ObjectType } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import _ from 'lodash'
import DummyAdapter from './adapter'
import { GeneratorParams, DUMMY_ADAPTER, defaultParams } from './generator'

export const configType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER),
  fields: _.mapValues(defaultParams, defValue => ({
    refType: _.isBoolean(defValue)
      ? createRefToElmWithValue(BuiltinTypes.BOOLEAN)
      : createRefToElmWithValue(BuiltinTypes.NUMBER),
    annotations: {
      [CORE_ANNOTATIONS.DEFAULT]: defValue,
    },
  })),
})

export const adapter: Adapter = {
  operations: context => new DummyAdapter(context.config?.value as GeneratorParams),
  validateCredentials: async () => '',
  authenticationMethods: ({ basic: {
    credentialsType: new ObjectType({ elemID: new ElemID(DUMMY_ADAPTER) }),
  } }),
  configType,
}
