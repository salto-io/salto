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
import { Field, ObjectType } from '@salto-io/adapter-api'
import { types, values } from '@salto-io/lowerdash'
import { SupportedToolingObject, ToolingObjectAnnotation, ToolingObjectInfo } from './constants'
import { API_NAME } from '../constants'

const { isDefined } = values

export type SupportedToolingObjectName = typeof SupportedToolingObject[keyof typeof SupportedToolingObject]

export type ToolingObjectType = ObjectType & {
  annotations: ObjectType['annotations'] & {
    [API_NAME]: SupportedToolingObjectName
    [ToolingObjectAnnotation.isToolingObject]: true
  }
  fields: Record<string, Field & {
    parent: ToolingObjectType
    annotations: Field['annotations'] & {
      [API_NAME]: string
    }
  }>
}

export type ToolingField = types.ValueOf<ToolingObjectType['fields']>

export type ToolingObject = {
  SubscriberPackage: ToolingObjectType & {
    fields: ToolingObjectType['fields'] & Record<keyof typeof ToolingObjectInfo.SubscriberPackage.Field, ToolingField>
  }
}

// TypeGuards

export const isSupportedToolingObjectName = (objectName: string): objectName is SupportedToolingObjectName => (
  (Object.values(SupportedToolingObject) as ReadonlyArray<string>).includes(objectName)
)

export const isToolingObject = (object: ObjectType): object is ToolingObjectType => (
  object.annotations[ToolingObjectAnnotation.isToolingObject] === true
)

export const isToolingField = (field: Field): field is ToolingField => (
  isToolingObject(field.parent)
)

// ToolingObjectType TypeGuards

export const isSubscriberPackage = (
  toolingObject: ToolingObjectType
): toolingObject is ToolingObject['SubscriberPackage'] => (
  toolingObject.annotations[API_NAME] === SupportedToolingObject.SubscriberPackage
  && Object.keys(ToolingObjectInfo.SubscriberPackage.Field)
    .every(fieldName => isDefined(toolingObject.fields[fieldName]))
)
