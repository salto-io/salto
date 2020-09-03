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
import { Field, Element, isElement } from '@salto-io/adapter-api'
import { GetLookupNameFunc, GetLookupNameFuncArgs } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { apiName, metadataType } from './transformer'
import {
  LAYOUT_ITEM_METADATA_TYPE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_ACTION_REFERENCE_METADATA_TYPE,
} from '../constants'

const log = logger(module)

type ReferenceSerializationFunc = GetLookupNameFunc

type ReferenceSerializationStrategyName = 'absoluteApiName' | 'relativeApiName'
const ReferenceSerializationStrategyLookup: Record<
  ReferenceSerializationStrategyName, ReferenceSerializationFunc
> = {
  absoluteApiName: (({ ref }) => apiName(ref.value)),
  relativeApiName: ({ ref }) => apiName(ref.value, true),
}

type ReferenceResolutionStrategy = 'included' | 'instance_parent' | 'specific' | 'object'
type TargetElemType = 'field' | 'instance' | 'object'

export type ReferenceTargetDefinition = {
  type: TargetElemType
  strategy: ReferenceResolutionStrategy
  name?: string
}

/**
 * A rule defining how to convert values to reference expressions (on fetch),
 * and reference expressions back to values (on deploy).
 */
export type FieldReferenceDefinition = {
  src: {
    field: string | RegExp
    parentType?: string
  }
  serializationStrategy?: ReferenceSerializationStrategyName
  // When target is missing, the definition will only be used for resolving
  target?: ReferenceTargetDefinition
}

// Order matters - first successfully-resolved reference is used
// TODO once this stabilizes, move to config file
const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
  // TODO will be populated as part of SALTO-942 and used instead of instance_references

  // supporting all field names for backward compatibility with the old definitions.
  // TODO: change to individual field names and add target
  {
    // TODO fields: field, customLink
    src: { field: /.*/, parentType: LAYOUT_ITEM_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
  },
  {
    // TODO field: fieldUpdates
    src: { field: /.*/, parentType: WORKFLOW_FIELD_UPDATE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
  },
  {
    src: { field: 'name', parentType: WORKFLOW_ACTION_REFERENCE_METADATA_TYPE },
    serializationStrategy: 'relativeApiName',
    // target will be added as part of SALTO-942
  },
]

const matchName = (fieldName: string, matcher: string | RegExp): boolean => (
  _.isString(matcher)
    ? matcher === fieldName
    : matcher.test(fieldName)
)

const matchMetadataType = (elem: Element, type: string | undefined): boolean => (
  // need typeName for backward compatibility - TODO remove after verifying
  type === undefined ? true : (metadataType(elem) === type || elem.elemID.typeName === type)
)

export class FieldReferenceResolver {
  refDef: FieldReferenceDefinition
  constructor(refDef: FieldReferenceDefinition) {
    this.refDef = refDef
  }

  static create(refDef: FieldReferenceDefinition): FieldReferenceResolver {
    return new FieldReferenceResolver(refDef)
  }

  match(field: Field): boolean {
    return (
      matchName(field.name, this.refDef.src.field)
      && matchMetadataType(field.parent, this.refDef.src.parentType)
    )
  }

  serializationStrategy(): ReferenceSerializationFunc {
    return ReferenceSerializationStrategyLookup[this.refDef.serializationStrategy ?? 'absoluteApiName']
  }

  refTarget(): ReferenceTargetDefinition | undefined {
    return this.refDef.target
  }
}

export const generateReferenceRules = (): FieldReferenceResolver[] => (
  fieldNameToTypeMappingDefs.map(def => FieldReferenceResolver.create(def))
)

const getLookUpNameImpl = (): GetLookupNameFunc => {
  const referenceRulesInner = generateReferenceRules()

  const determineLookupFunc = (args: GetLookupNameFuncArgs): ReferenceSerializationFunc => {
    const strategies = referenceRulesInner
      .filter(def => args.field !== undefined && def.match(args.field))
      .map(def => def.serializationStrategy())

    if (strategies.length > 1) {
      log.debug(`found ${strategies.length} matching strategies for field ${args.field?.elemID.getFullName()} - using the first one`)
    }
    if (strategies.length === 0) {
      log.debug(`could not find matching strategy for field ${args.field?.elemID.getFullName()}`)
    }
    return strategies[0] ?? ReferenceSerializationStrategyLookup.absoluteApiName
  }

  return ({ ref, path, field }) => {
    if (isElement(ref.value)) {
      const lookupFunc = determineLookupFunc({ ref, path, field })
      return lookupFunc({ ref })
    }
    return ref.value
  }
}

export const getLookUpName = getLookUpNameImpl()
