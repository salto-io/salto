import _ from 'lodash'

import {
  InstanceElement, ElemID, ObjectType, Type, Values, isObjectType,
} from 'adapter-api'

import {
  MergeResult, MergeError, mergeNoDuplicates,
} from './common'

export class DuplicateInstanceKeyError extends MergeError {
  readonly key: string

  constructor({ elemID, key }: { elemID: ElemID; key: string }) {
    super({ elemID, error: `duplicate key ${key}` })
    this.key = key
  }
}

const buildDefaults = (
  type: Type
): Values | undefined => {
  const buildObjectDefaults = (object: ObjectType): Values | undefined => {
    const def = _(object.fields).mapValues(field =>
      ((field.annotations[Type.DEFAULT] === undefined && !field.isList)
        ? buildDefaults(field.type)
        : field.annotations[Type.DEFAULT])).pickBy(v => v !== undefined).value()
    return _.isEmpty(def) ? undefined : def
  }

  return (type.annotations[Type.DEFAULT] === undefined && isObjectType(type)
    ? buildObjectDefaults(type)
    : type.annotations[Type.DEFAULT])
}

const mergeInstanceDefinitions = (
  { elemID, type }: { elemID: ElemID; type: ObjectType },
  instanceDefs: InstanceElement[]
): MergeResult<InstanceElement> => {
  const valueMergeResult = instanceDefs.length > 1 ? mergeNoDuplicates(
    instanceDefs.map(i => i.value),
    key => new DuplicateInstanceKeyError({ elemID, key })
  ) : {
    merged: instanceDefs[0].value,
    errors: [],
  }

  const defaults = buildDefaults(type)
  const valueWithDefault = !_.isEmpty(defaults)
    ? _.merge({}, defaults || {}, valueMergeResult.merged)
    : valueMergeResult.merged
  return {
    merged: new InstanceElement(elemID, type, valueWithDefault),
    errors: valueMergeResult.errors,
  }
}

export const mergeInstances = (
  instances: InstanceElement[]
): MergeResult<InstanceElement[]> => {
  const mergeResults = _(instances)
    .groupBy(i => i.elemID.getFullName())
    .map(elementGroup => mergeInstanceDefinitions(elementGroup[0], elementGroup))
    .value()

  return {
    merged: mergeResults.map(r => r.merged),
    errors: _.flatten(mergeResults.map(r => r.errors)),
  }
}
