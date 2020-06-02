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
import { ObjectType, ElemID, PrimitiveType, PrimitiveTypes, BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'

const sfText = new PrimitiveType({
  elemID: new ElemID('salesforce', 'Text'),
  primitive: PrimitiveTypes.STRING,
  annotationTypes: {
    label: BuiltinTypes.STRING,
    _required: BuiltinTypes.BOOLEAN,
  },
})

const sfRole = new ObjectType({
  elemID: new ElemID('salesforce', 'Role'),
  annotationTypes: {
    metadataType: BuiltinTypes.SERVICE_ID,
  },
  annotations: {
    metadataType: 'Role',
  },
  fields: {
    description: { type: BuiltinTypes.STRING },
    name: { type: BuiltinTypes.STRING },
  },
})

export const customObject = (
  data: {objName: string; alphaLabel: string; betaLabel: string}
): ObjectType => {
  const elemID = new ElemID('salesforce', data.objName)
  return new ObjectType({
    elemID,
    fields: {
      alpha: { type: sfText, annotations: { label: data.alphaLabel } },
      beta: { type: sfText, annotations: { label: data.betaLabel } },
    },
  })
}

export const instance = (
  data: {instName: string; description: string}
): InstanceElement => new InstanceElement(data.instName, sfRole, {
  description: data.description,
  name: data.instName,
})
