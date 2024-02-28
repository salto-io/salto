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
import { ObjectType, ElemID, PrimitiveType, PrimitiveTypes, BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'

export const customObject = (data: {
  objName: string
  alphaLabel: string
  betaLabel: string
  accountName?: string
}): ObjectType => {
  const adapter = data.accountName ?? 'salesforce'
  const sfText = new PrimitiveType({
    elemID: new ElemID(adapter, 'Text'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {
      label: BuiltinTypes.STRING,
      _required: BuiltinTypes.BOOLEAN,
    },
  })
  const elemID = new ElemID(adapter, data.objName)
  return new ObjectType({
    elemID,
    fields: {
      alpha: {
        refType: sfText,
        annotations: { label: data.alphaLabel },
      },
      beta: {
        refType: sfText,
        annotations: { label: data.betaLabel },
      },
    },
    annotations: {
      deploymentStatus: 'Deployed',
      pluralLabel: 'Tests',
      sharingModel: 'ReadWrite',
      nameField: { type: 'Text', label: 'Name' },
    },
    annotationRefsOrTypes: {
      deploymentStatus: BuiltinTypes.STRING,
      pluralLabel: BuiltinTypes.STRING,
      sharingModel: BuiltinTypes.STRING,
      nameField: new ObjectType({ elemID: new ElemID(adapter, 'CustomField') }),
    },
  })
}

export const instance = (data: { instName: string; description: string; accountName?: string }): InstanceElement => {
  const adapter = data.accountName ?? 'salesforce'
  const sfRole = new ObjectType({
    elemID: new ElemID(adapter, 'Role'),
    annotationRefsOrTypes: {
      metadataType: BuiltinTypes.SERVICE_ID,
      suffix: BuiltinTypes.STRING,
      dirName: BuiltinTypes.STRING,
    },
    annotations: {
      metadataType: 'Role',
      suffix: 'role',
      dirName: 'roles',
    },
    fields: {
      description: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })
  return new InstanceElement(data.instName, sfRole, {
    description: data.description,
    name: data.instName,
  })
}
