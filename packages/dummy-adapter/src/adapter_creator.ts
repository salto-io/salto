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
import { Adapter, ElemID, CORE_ANNOTATIONS, BuiltinTypes, ObjectType, ListType, GetCustomReferencesFunc, FixElementsFunc, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import DummyAdapter from './adapter'
import { GeneratorParams, DUMMY_ADAPTER, defaultParams, changeErrorType } from './generator'

export const configType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER),
  fields: {
    ..._.mapValues(defaultParams, defValue => ({
      refType: _.isBoolean(defValue)
        ? BuiltinTypes.BOOLEAN
        : BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: defValue,
      },
    })),
    changeErrors: { refType: new ListType(changeErrorType) },
    extraNaclPath: { refType: BuiltinTypes.STRING },
    generateEnvName: { refType: BuiltinTypes.STRING },
    fieldsToOmitOnDeploy: { refType: new ListType(BuiltinTypes.STRING) },
    // Exclude elements from the fetch by their elemIDs
    elementsToExclude: { refType: new ListType(BuiltinTypes.STRING) },
  },
})

const getCustomReferences: GetCustomReferencesFunc = async elements => (
  elements.find(e => e.elemID.getFullName() === 'dummy.Full.instance.FullInst1')
    ? [{
      source: ElemID.fromFullName('dummy.Full.instance.FullInst1.strField'),
      target: ElemID.fromFullName('dummy.Full.instance.FullInst2.strField'),
      type: 'weak',
    }]
    : []
)

const fixElements: FixElementsFunc = async elements => {
  const fullInst1 = elements.find(e => e.elemID.getFullName() === 'dummy.Full.instance.FullInst1')
  if (!isInstanceElement(fullInst1)) {
    return []
  }

  if (fullInst1.value.strField === undefined) {
    return []
  }

  delete fullInst1.value.strField

  return [{
    message: 'Fixed FullInst1.strField',
    detailedMessage: 'Removed FullInst1.strField',
    severity: 'Info',
    fixedElement: fullInst1,
  }]
}

export const adapter: Adapter = {
  operations: context => new DummyAdapter(context.config?.value as GeneratorParams),
  validateCredentials: async () => ({ accountId: '' }),
  authenticationMethods: ({ basic: {
    credentialsType: new ObjectType({ elemID: new ElemID(DUMMY_ADAPTER) }),
  } }),
  configType,
  getCustomReferences,
  fixElements,
}
