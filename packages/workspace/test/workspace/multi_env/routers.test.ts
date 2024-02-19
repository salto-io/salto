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
import _ from 'lodash'
import { detailedCompare } from '@salto-io/adapter-utils'
import {
  ElemID,
  Field,
  BuiltinTypes,
  ObjectType,
  ListType,
  InstanceElement,
  DetailedChange,
  PrimitiveType,
  PrimitiveTypes,
  isField,
  getChangeData,
  Change,
  ReferenceExpression,
  INSTANCE_ANNOTATIONS,
  toChange,
} from '@salto-io/adapter-api'
import { ModificationDiff, RemovalDiff, AdditionDiff } from '@salto-io/dag'
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import {
  routeChanges,
  routePromote,
  routeDemote,
  routeCopyTo,
  getMergeableParentID,
  routeRemoveFrom,
} from '../../../src/workspace/nacl_files/multi_env/routers'

const hasChanges = (changes: DetailedChange[], lookup: { action: string; id: ElemID }[]): boolean =>
  _.every(
    lookup.map(changeToFind => changes.find(c => changeToFind.id.isEqual(c.id) && changeToFind.action === c.action)),
  )

const objectElemID = new ElemID('salto', 'object')
const commonField = { name: 'commonField', refType: BuiltinTypes.STRING }
const envField = { name: 'envField', refType: BuiltinTypes.STRING }
const simpleObjID = new ElemID('salto', 'simple')
const simpleObj = new ObjectType({
  elemID: simpleObjID,
  annotationRefsOrTypes: {
    str1: BuiltinTypes.STRING,
    str2: BuiltinTypes.STRING,
  },
})
const listField = { name: 'listField', refType: new ListType(simpleObj) }
const commonObj = new ObjectType({
  elemID: objectElemID,
  annotationRefsOrTypes: {
    boolean: BuiltinTypes.BOOLEAN,
  },
  annotations: {
    boolean: false,
    arr: [{ a: 'a' }],
  },
  fields: {
    commonField,
    listField,
  },
})
const envObj = new ObjectType({
  elemID: objectElemID,
  fields: {
    envField,
  },
})
const sharedObject = new ObjectType({
  elemID: objectElemID,
  annotationRefsOrTypes: {
    boolean: BuiltinTypes.BOOLEAN,
  },
  annotations: {
    boolean: false,
    arr: [{ a: 'a' }],
  },
  fields: {
    envField,
    commonField,
    listField,
  },
})

const newObj = new ObjectType({ elemID: new ElemID('salto', 'new') })

const commonInstance = new InstanceElement('commonInst', commonObj, {
  commonField: 'commonField',
  listField: [
    {
      str1: 'STR_1',
    },
  ],
})
const splitObjectID = new ElemID('salto', 'split')
const splitObjectFields = new ObjectType({
  elemID: splitObjectID,
  fields: commonObj.fields,
})
const splitObjectAnnotations = new ObjectType({
  elemID: splitObjectID,
  annotations: commonObj.annotations,
})
const splitObjectAnnotationTypes = new ObjectType({
  elemID: splitObjectID,
  annotationRefsOrTypes: commonObj.annotationRefTypes,
})
const splitObjJoined = new ObjectType({
  elemID: splitObjectID,
  fields: splitObjectFields.fields,
  annotationRefsOrTypes: splitObjectAnnotationTypes.annotationRefTypes,
  annotations: splitObjectAnnotations.annotations,
})
const splitInstName = 'splitInst'
const splitInstance1 = new InstanceElement(splitInstName, commonObj, {
  commonField: 'STR',
})
const splitInstance2 = new InstanceElement(splitInstName, commonObj, {
  listField: ['STR'],
})
const splitInstanceJoined = new InstanceElement(splitInstName, commonObj, {
  ...splitInstance1.value,
  ...splitInstance2.value,
})
const commonOnlyObject = new ObjectType({
  elemID: new ElemID('salto', 'commonOnly'),
})

const commonOnlyFieldObjectID = new ElemID('salto', 'CommonOnlyFieldObject')
const commonCommonOnlyFieldObject = new ObjectType({
  elemID: commonOnlyFieldObjectID,
  fields: {
    ofdreams: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        catchphrase: 'if you will build it',
      },
    },
  },
})

const envCommonOnlyFieldObject = new ObjectType({
  elemID: commonOnlyFieldObjectID,
})

const commonObjWithList = new ObjectType({
  elemID: new ElemID('salto', 'withList'),
  annotationRefsOrTypes: {
    boolean: BuiltinTypes.BOOLEAN,
    list: BuiltinTypes.NUMBER, // No need to list type this this is annotations...
  },
  annotations: {
    boolean: false,
    list: [1, 2, 3],
  },
})

const partiallyCommonObjID = new ElemID('salto', 'partiallyCommon')
const partiallyCommonObjEnv = new ObjectType({
  elemID: partiallyCommonObjID,
  fields: {
    field: {
      refType: BuiltinTypes.STRING,
    },
  },
})

const partiallyCommonObjCommon = new ObjectType({
  elemID: partiallyCommonObjID,
  fields: {
    commonField: {
      refType: BuiltinTypes.STRING,
    },
  },
})

const commonSource = createMockNaclFileSource(
  [
    commonObj,
    commonInstance,
    splitObjJoined,
    splitInstanceJoined,
    commonOnlyObject,
    commonCommonOnlyFieldObject,
    commonObjWithList,
    partiallyCommonObjCommon,
  ],
  {
    'test/path.nacl': [commonObj, commonInstance, commonOnlyObject],
    'test/anno.nacl': [splitObjectAnnotations],
    'test/annoTypes.nacl': [splitObjectAnnotationTypes],
    'test/fields.nacl': [splitObjectFields],
    'test/inst1.nacl': [splitInstance1],
    'test/inst2.nacl': [splitInstance2],
    'test/onlyfields.nacl': [commonCommonOnlyFieldObject],
    'test/withlists.nacl': [commonObjWithList],
    'test/partially.nacl': [partiallyCommonObjCommon],
  },
)

const envOnlyID = new ElemID('salto', 'envOnly')
const envOnlyObj = new ObjectType({ elemID: envOnlyID })
const envSource = createMockNaclFileSource([envObj, envOnlyObj, envCommonOnlyFieldObject, partiallyCommonObjEnv], {
  'test:/envObj.nacl': [envObj],
  'test:/envOnlyObj.nacl': [envOnlyObj],
  'test:/envCommonOnlyFieldObject.nacl': [envCommonOnlyFieldObject],
  'test:/partiallyCommonObjEnv.nacl': [partiallyCommonObjEnv],
})
const secEnv = createMockNaclFileSource([envObj, envCommonOnlyFieldObject])
const primarySrcName = 'primarySource'
const secSrcName = 'secSource'
const envSources = {
  [primarySrcName]: envSource,
  [secSrcName]: secEnv,
}

const onlyPrimSrc = {
  [primarySrcName]: envSource,
}

describe('default fetch routing', () => {
  it('should route add changes to common when there is only one configured env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      primarySrcName,
      commonSource,
      { [primarySrcName]: envSource },
      'default',
    )
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route add changes to primary env when there are more then one configured env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should handle ridiculously large changeset without stack overflow', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const changes: DetailedChange[] = []
    for (let i = 0; i < 140000; i += 1) {
      changes.push(change)
    }
    await routeChanges(changes, primarySrcName, commonSource, envSources, 'default')
  })

  it('should handle empty changeset without error', async () => {
    const changes: DetailedChange[] = []
    await routeChanges(changes, primarySrcName, commonSource, envSources, 'default')
  })

  it('should route nested add changes to primary env when the containing element is not in common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'value' },
      id: envOnlyObj.elemID.createNestedID('attr', 'newAttr'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route nested add changes to primary env when the containing element is in common but also in primary env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'value' },
      id: commonObj.elemID.createNestedID('attr', 'newAttr'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route nested add changes to common when the containing element is only in common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'value' },
      id: commonOnlyObject.elemID.createNestedID('attr', 'newAttr'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route nested add changes to common when the direct parent is only in common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'value' },
      id: commonObj.fields.commonField.elemID.createNestedID('label'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route common modify changes to common', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: false, after: true },
      id: commonObj.elemID.createNestedID('attr', 'boolean'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route env modify changes to env', async () => {
    const newEnvField = new Field(envObj, envField.name, BuiltinTypes.NUMBER)
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj.fields[envField.name], after: newEnvField },
      id: newEnvField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route common remove changes to common', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: commonObj.fields.commonField },
      id: commonObj.fields.commonField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route env remove changes to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj.fields.envField },
      id: envObj.fields.envField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should split shared remove changes to all environments', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChangeData =
      routedChanges.commonSource && (routedChanges.commonSource[0] as RemovalDiff<ObjectType>).data.before
    const envChangeData =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as RemovalDiff<ObjectType>).data.before
    expect(commonChangeData).toEqual(commonObj)
    expect(envChangeData).toEqual(envObj)
    expect(routedChanges.envSources?.[secSrcName]).toHaveLength(1)
  })
  it(
    'should route add changes of values of env specific elements to the ' +
      'env when there are multiple envs configured',
    async () => {
      const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
      const change: DetailedChange = {
        action: 'add',
        data: { after: newField },
        id: newField.elemID,
      }
      const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'default')
      expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
      expect(routedChanges.commonSource).toHaveLength(0)
      expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
      expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
    },
  )
  it('should route add changes of values of env specific elements to the env when there is only one env configured', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of common elements to the primary env', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of split elements to the common when there is only one env', async () => {
    const newField = new Field(splitObjJoined, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'default')
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
})

describe('align fetch routing', () => {
  it('should route add changes to primary source', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should drop add changes if the mergeable id is in common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'B' },
      id: commonObj.elemID.createNestedID('attr', 'arr', '0', 'b'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route add changes to primary source and wrap if direct parent is missing', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: 'TEST' },
      id: partiallyCommonObjCommon.fields.commonField.elemID.createNestedID('test'),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    const primaryChange = routedChanges.envSources?.[primarySrcName][0]
    expect(primaryChange?.id).toEqual(partiallyCommonObjCommon.fields.commonField.elemID)
    expect(isField(getChangeData(primaryChange as Change<Field>))).toBeTruthy()
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should drop common modify changes', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: commonObj.fields.commonField, after: commonObj.fields.commonField },
      id: commonObj.fields.commonField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route env modify changes to env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj, after: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should split shared modify changes and drop the common part', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    const envChangeBeforeElement =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as ModificationDiff<ObjectType>).data.before
    expect(envChangeBeforeElement).toEqual(envObj)
    const envChangeAfterElement =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as ModificationDiff<ObjectType>).data.after
    expect(envChangeAfterElement).toEqual(envObj)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should drop common remove changes', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: commonObj.fields.commonField },
      id: commonObj.fields.commonField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route env remove changes to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should split shared remove changes and drop common part', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    const envChangeData =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as RemovalDiff<ObjectType>).data.before
    expect(envChangeData).toEqual(envObj)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of env specific elements to the env', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of common elements to env', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of instance annotations to env as annotations in a wrapped instance', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: [new ReferenceExpression(commonObj.elemID)] },
      id: commonInstance.elemID.createNestedID(INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES),
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'align')
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    const envChange = routedChanges.envSources?.[primarySrcName]?.[0] as DetailedChange
    expect(envChange.action).toEqual('add')
    const envChangeInstance = getChangeData(envChange) as InstanceElement
    expect(envChangeInstance).toBeInstanceOf(InstanceElement)
    expect(envChangeInstance.annotations).toHaveProperty(INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES, change.data.after)
  })
})

describe('override fetch routing', () => {
  it('should route add changes to common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })

  it('should route common modify changes to common', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: commonObj.fields.commonField, after: commonObj.fields.commonField },
      id: commonObj.fields.commonField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route env modify changes to env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj.fields.envField, after: envObj.fields.envField },
      id: envObj.fields.envField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should split shared modify changes to common and env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChangeBeforeElement =
      routedChanges.commonSource && (routedChanges.commonSource[0] as ModificationDiff<ObjectType>).data.before
    const envChangeBeforeElement =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as ModificationDiff<ObjectType>).data.before
    expect(commonChangeBeforeElement).toEqual(commonObj)
    expect(envChangeBeforeElement).toEqual(envObj)
    const commonChangeAfterElement =
      routedChanges.commonSource && (routedChanges.commonSource[0] as ModificationDiff<ObjectType>).data.after
    const envChangeAfterElement =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as ModificationDiff<ObjectType>).data.after
    expect(commonChangeAfterElement).toEqual(commonObj)
    expect(envChangeAfterElement).toEqual(envObj)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route common remove changes to common', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: commonObj.fields.commonField },
      id: commonObj.fields.commonField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route env remove changes to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj.fields.envField },
      id: envObj.fields.envField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should split shared remove changes to common and env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'override')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChangeData =
      routedChanges.commonSource && (routedChanges.commonSource[0] as RemovalDiff<ObjectType>).data.before
    const envChangeData =
      routedChanges.envSources?.[primarySrcName] &&
      (routedChanges.envSources?.[primarySrcName][0] as RemovalDiff<ObjectType>).data.before
    expect(commonChangeData).toEqual(commonObj)
    expect(envChangeData).toEqual(envObj)
    expect(routedChanges.envSources?.[secSrcName]).toHaveLength(1)
  })
  it('should route add changes of values of env specific elements to the env', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of common elements to the common', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
  it('should route add changes of values of split elements to the common', async () => {
    const newField = new Field(splitObjJoined, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, onlyPrimSrc, 'override')
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
  })
})

describe('isolated routing', () => {
  it('should route an add change to env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toMatchObject(
      change,
    )
  })
  it('should route an env modification change to env', async () => {
    const newField = new Field(envObj, envField.name, BuiltinTypes.NUMBER)
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj.fields.envField, after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toMatchObject(
      change,
    )
  })
  it('should route an env remove diff to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj.fields.envField },
      id: envObj.fields.envField.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(_.omit(routedChanges.envSources, [primarySrcName]))).toBeTruthy()
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toMatchObject(
      change,
    )
  })
  it('should route a common modification diff to common and revert the change in secondary envs', async () => {
    const primarySrcObj = envObj.clone()
    primarySrcObj.annotate({ boolean: true })
    const secSrcObj = envObj.clone()
    secSrcObj.annotate({ boolean: false })
    const specificChange: DetailedChange = {
      action: 'modify',
      data: { before: false, after: true },
      id: objectElemID.createNestedID('attr').createNestedID('boolean'),
    }
    const routedChanges = await routeChanges([specificChange], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[secSrcName]).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName]?.[0]).toEqual({
      action: 'add',
      data: { after: specificChange.data.after },
      elemIDs: {
        before: specificChange.id,
        after: specificChange.id,
      },
      id: specificChange.id,
      path: ['test', 'path'],
      baseChange: toChange({ before: envObj, after: primarySrcObj }),
    })
    expect(routedChanges.commonSource?.[0]).toEqual({
      action: 'remove',
      data: { before: specificChange.data.before },
      id: specificChange.id,
      path: ['test', 'path'],
    })
    expect(routedChanges.envSources?.[secSrcName][0]).toEqual({
      action: 'add',
      data: { after: specificChange.data.before },
      id: specificChange.id,
      elemIDs: {
        before: specificChange.id,
        after: specificChange.id,
      },
      path: ['test', 'path'],
      baseChange: toChange({ before: envObj, after: secSrcObj }),
    })
  })
  it('should route a common removal diff to common and revert the change in secondary envs', async () => {
    const splitObjChange: DetailedChange = {
      action: 'remove',
      data: { before: splitObjJoined },
      id: splitObjectID,
    }
    const splitInstChange: DetailedChange = {
      action: 'remove',
      data: { before: splitInstanceJoined },
      id: splitInstanceJoined.elemID,
    }
    const routedChanges = await routeChanges(
      [splitObjChange, splitInstChange],
      primarySrcName,
      commonSource,
      envSources,
      'isolated',
    )
    expect(routedChanges.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(2)
    expect(routedChanges.commonSource && routedChanges.commonSource[0].action).toEqual('remove')
    expect(routedChanges.commonSource && routedChanges.commonSource[0].id).toEqual(splitObjectID)
    expect(routedChanges.commonSource && routedChanges.commonSource[1].action).toEqual('remove')
    expect(routedChanges.commonSource && routedChanges.commonSource[1].id).toEqual(splitInstanceJoined.elemID)

    const secChanges = routedChanges.envSources?.[secSrcName]
    expect(secChanges).toHaveLength(5)
    expect(secChanges && secChanges[0]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectAnnotations },
      path: ['test', 'anno'],
    })
    expect(secChanges && secChanges[1]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectAnnotationTypes },
      path: ['test', 'annoTypes'],
    })
    expect(secChanges && secChanges[2]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectFields },
      path: ['test', 'fields'],
    })
    expect(secChanges && secChanges[3]).toEqual({
      action: 'add',
      id: splitInstanceJoined.elemID,
      data: { after: splitInstance1 },
      path: ['test', 'inst1'],
    })
    expect(secChanges && secChanges[4]).toEqual({
      action: 'add',
      id: splitInstanceJoined.elemID,
      data: { after: splitInstance2 },
      path: ['test', 'inst2'],
    })
  })
  it('should route a removal diff to common and env and revert the change in secondary envs', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: sharedObject.elemID,
    }
    const routedChanges = await routeChanges([change], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]).toMatchObject({
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    })
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toMatchObject({
      action: 'remove',
      data: { before: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
    const expectedChanges = detailedCompare(envObj, sharedObject).map(expectedChange => ({
      ...expectedChange,
      path: ['test', 'path'],
    }))
    expectedChanges.forEach(expectedChange =>
      expect(routedChanges.envSources?.[secSrcName]).toContainEqual(expectedChange),
    )
  })

  it('should merge non mergeable changes into one mergeable change', async () => {
    const removeChange: DetailedChange = {
      action: 'remove',
      data: { before: 'STR_1' },
      id: commonInstance.elemID.createNestedID('listField', '0', 'str1'),
    }
    const addChange: DetailedChange = {
      action: 'add',
      data: { after: 'STR_2' },
      id: commonInstance.elemID.createNestedID('listField', '0', 'str2'),
    }
    const routedChanges = await routeChanges(
      [removeChange, addChange],
      primarySrcName,
      commonSource,
      envSources,
      'isolated',
    )
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    const primaryChange = routedChanges.envSources?.[primarySrcName] && routedChanges.envSources?.[primarySrcName][0]
    expect(primaryChange).toEqual({
      action: 'add',
      id: commonInstance.elemID,
      data: {
        after: new InstanceElement('commonInst', commonObj, {
          listField: [
            {
              str2: 'STR_2',
            },
          ],
        }),
      },
      path: ['test', 'path'],
    })
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChange = routedChanges.commonSource && routedChanges.commonSource[0]
    expect(commonChange).toEqual({
      action: 'remove',
      id: commonInstance.elemID.createNestedID('listField'),
      data: {
        before: [{ str1: 'STR_1' }],
      },
      path: ['test', 'path'],
    })
    const secondaryChange = routedChanges.envSources?.[secSrcName]?.[0]
    expect(secondaryChange).toEqual({
      action: 'add',
      id: commonInstance.elemID,
      data: {
        after: new InstanceElement('commonInst', commonObj, {
          listField: [
            {
              str1: 'STR_1',
            },
          ],
        }),
      },
      path: ['test', 'path'],
    })
  })

  it(
    'should route a common modification diff to common and revert the change in ' +
      'secondary envs for nested elements without parents in the env',
    async () => {
      const fieldID = commonOnlyFieldObjectID.createNestedID('field', 'ofdreams')
      const specificChange: DetailedChange = {
        action: 'modify',
        data: { before: 'if you build it', after: 'they will come' },
        id: fieldID.createNestedID('catchphrase'),
      }
      const beforeField = commonCommonOnlyFieldObject.fields.ofdreams
      const afterObject = new ObjectType({
        ...commonCommonOnlyFieldObject,
        fields: {
          ofdreams: {
            ...commonCommonOnlyFieldObject.fields.ofdreams,
            annotations: {
              catchphrase: specificChange.data.after,
            },
          },
        },
      })
      const afterField = afterObject.fields.ofdreams
      const routedChanges = await routeChanges([specificChange], primarySrcName, commonSource, envSources, 'isolated')
      expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
      expect(routedChanges.commonSource).toHaveLength(1)
      expect(routedChanges.envSources?.[secSrcName]).toHaveLength(1)
      expect(routedChanges.envSources?.[primarySrcName]?.[0].action).toEqual('add')
      const primaryChangeData = routedChanges.envSources?.[primarySrcName]?.[0] as AdditionDiff<Field>
      expect(routedChanges.envSources?.[primarySrcName]?.[0].id).toEqual(fieldID)
      expect(primaryChangeData.data.after.refType.elemID).toEqual(afterField.refType.elemID)
      expect(primaryChangeData.data.after.annotations).toEqual(afterField.annotations)

      expect(routedChanges.commonSource?.[0].action).toEqual('remove')
      expect(routedChanges.commonSource?.[0].id).toEqual(specificChange.id)

      expect(routedChanges.envSources?.[primarySrcName]?.[0].action).toEqual('add')
      const secChangeData = routedChanges.envSources?.[secSrcName][0] as AdditionDiff<Field>
      expect(routedChanges.envSources?.[secSrcName][0].id).toEqual(fieldID)
      expect(secChangeData.data.after.refType.elemID).toEqual(beforeField.refType.elemID)
      expect(secChangeData.data.after.annotations).toEqual(beforeField.annotations)
    },
  )
  it('name', async () => {
    const annotationID = commonObjWithList.elemID.createNestedID('attr', 'list')
    const specificChange: DetailedChange = {
      action: 'modify',
      data: { before: [1, 2, 3], after: [1, 2, 3, 4] },
      id: annotationID,
    }
    const routedChanges = await routeChanges([specificChange], primarySrcName, commonSource, envSources, 'isolated')
    expect(routedChanges.envSources?.[primarySrcName]).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.envSources?.[secSrcName]).toHaveLength(1)
    expect(routedChanges.envSources?.[primarySrcName]?.[0].action).toEqual('add')
    const primaryChangeData = routedChanges.envSources?.[primarySrcName]?.[0] as AdditionDiff<ObjectType>
    expect(routedChanges.envSources?.[primarySrcName]?.[0].id).toEqual(commonObjWithList.elemID)
    expect(primaryChangeData.data.after.annotations.list).toEqual([1, 2, 3, 4])

    expect(routedChanges.commonSource?.[0].action).toEqual('remove')
    expect(routedChanges.commonSource?.[0].id).toEqual(specificChange.id)

    expect(routedChanges.envSources?.[primarySrcName]?.[0].action).toEqual('add')
    const secChangeData = routedChanges.envSources?.[secSrcName][0] as AdditionDiff<Field>
    expect(routedChanges.envSources?.[secSrcName][0].id).toEqual(commonObjWithList.elemID)
    expect(secChangeData.data.after.annotations.list).toEqual([1, 2, 3])
  })
})

describe('track', () => {
  const onlyInEnvElemID = new ElemID('salto', 'onlyInEnvObj')
  const onlyInEnvObj = new ObjectType({
    elemID: onlyInEnvElemID,
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
        annotations: {
          anno: 'anno',
        },
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const otherPartOfOnlyInEnvObj = new ObjectType({
    elemID: onlyInEnvElemID,
    fields: {
      otherPartField: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const mergedOnlyInEnvObject = new ObjectType({
    elemID: onlyInEnvElemID,
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
        annotations: {
          anno: 'anno',
        },
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
      otherPartField: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      envField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
    annotationRefsOrTypes: {
      env: BuiltinTypes.STRING,
      internalId: BuiltinTypes.HIDDEN_STRING,
    },
    annotations: {
      env: 'ENV',
      split: {
        env: 'ENV',
      },
    },
  })

  const splitObjCommon = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      commonField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
    annotationRefsOrTypes: {
      common: BuiltinTypes.STRING,
    },
    annotations: {
      common: 'COMMON',
      split: {
        common: 'COMMON',
      },
    },
  })

  const onlyInCommon = new ObjectType({
    elemID: new ElemID('salto', 'onlyInCommonObj'),
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const multiFileInstaceDefault = new InstanceElement('split', onlyInEnvObj, {
    default: 'DEFAULT',
  })
  const multiFileInstaceOther = new InstanceElement('split', onlyInEnvObj, {
    other: 'OTHER',
  })
  const multiFileInstace = new InstanceElement('split', onlyInEnvObj, {
    other: 'OTHER',
    default: 'DEFAULT',
  })

  const inSecObject = new ObjectType({
    elemID: new ElemID('salto', 'inSec'),
  })
  const primaryElements = [mergedOnlyInEnvObject, splitObjEnv, multiFileInstace, inSecObject]
  const secondaryElements = [inSecObject]
  const commonElements = [splitObjCommon, onlyInCommon]

  const primarySrc = createMockNaclFileSource(primaryElements, {
    'default.nacl': [onlyInEnvObj, splitObjEnv, multiFileInstaceDefault, inSecObject],
    'other.nacl': [multiFileInstaceOther, otherPartOfOnlyInEnvObj],
  })
  const commonSrc = createMockNaclFileSource(commonElements, { 'default.nacl': commonElements })

  const trackEnvSources = {
    [primarySrcName]: primarySrc,
    [secSrcName]: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should throw the proper error when trying to move an element which is not in the origin env', async () => {
    await expect(
      routePromote([ElemID.fromFullName('salto.noop')], primarySrcName, commonSrc, trackEnvSources),
    ).rejects.toThrow('does not exist in origin')
  })

  it('should move an entire element in two diff files if not in common and split in source', async () => {
    const changes = await routePromote([onlyInEnvElemID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(2)
    expect(changes.envSources?.[secSrcName]).toHaveLength(0)
    const primaryChange = changes.envSources?.[primarySrcName]?.[0]
    expect(primaryChange?.id).toEqual(onlyInEnvElemID)
    expect(primaryChange?.action).toEqual('remove')
    const firstPartCommonChange = changes.commonSource && changes.commonSource[0]
    expect(firstPartCommonChange?.id).toEqual(onlyInEnvElemID)
    expect(firstPartCommonChange?.action).toEqual('add')
    expect(firstPartCommonChange?.data).toEqual({ after: onlyInEnvObj })
    const secondPartCommonChange = changes.commonSource && changes.commonSource[1]
    expect(secondPartCommonChange?.id).toEqual(onlyInEnvElemID)
    expect(secondPartCommonChange?.action).toEqual('add')
    expect(secondPartCommonChange?.data).toEqual({ after: otherPartOfOnlyInEnvObj })
  })

  it('should create detailed changes when an element fragment is present in the common source', async () => {
    const changes = await routePromote([splitObjEnv.elemID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(6)
    expect(
      hasChanges(changes.commonSource || [], [
        { action: 'add', id: splitObjEnv.elemID.createNestedID('annotation', 'env') },
        { action: 'add', id: splitObjEnv.elemID.createNestedID('annotation', 'internalId') },
        { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'split', 'env') },
        { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'env') },
        { action: 'add', id: splitObjEnv.fields.envField.elemID },
        { action: 'add', id: splitObjEnv.fields.splitField.elemID.createNestedID('env') },
      ]),
    ).toBeTruthy()
  })

  it('should wrap nested ids in an object when moving nested ids of an element with no common fragment and without other parts of the element', async () => {
    const changes = await routePromote(
      [onlyInEnvObj.fields.str.elemID, onlyInEnvObj.elemID.createNestedID('attr', 'str')],
      primarySrcName,
      commonSrc,
      trackEnvSources,
    )
    expect(changes.envSources?.[primarySrcName]).toHaveLength(2)
    expect(changes.commonSource).toHaveLength(1)
    expect(hasChanges(changes.commonSource || [], [{ action: 'add', id: onlyInEnvObj.elemID }])).toBeTruthy()
  })

  it('should create detailed changes without wrapping the element if the element has fragments in common', async () => {
    const changes = await routePromote(
      [splitObjEnv.fields.envField.elemID, splitObjEnv.elemID.createNestedID('attr', 'env')],
      primarySrcName,
      commonSrc,
      trackEnvSources,
    )
    expect(changes.envSources?.[primarySrcName]).toHaveLength(2)
    expect(changes.commonSource).toHaveLength(2)
    expect(
      hasChanges(changes.commonSource || [], [
        { action: 'add', id: splitObjEnv.fields.envField.elemID },
        { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'env') },
      ]),
    ).toBeTruthy()
  })

  it('should maintain file structure when moving an element to common', async () => {
    const changes = await routePromote([multiFileInstace.elemID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(2)
    expect(changes.commonSource).toEqual([
      { action: 'add', id: multiFileInstace.elemID, path: ['default'], data: { after: multiFileInstaceDefault } },
      { action: 'add', id: multiFileInstace.elemID, path: ['other'], data: { after: multiFileInstaceOther } },
    ])
  })

  it('should delete the elements in all secondary envs as when promoted apps exist there', async () => {
    const changes = await routePromote([inSecObject.elemID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
  })
  it('should delete the elements that exist in the secondary envs when not all promoted elems exist there', async () => {
    const changes = await routePromote(
      [multiFileInstace.elemID, inSecObject.elemID],
      primarySrcName,
      commonSrc,
      trackEnvSources,
    )
    expect(changes.envSources?.[primarySrcName]).toHaveLength(2)
    expect(changes.commonSource).toHaveLength(3)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
  })

  it('should do nothing if only exists in common', async () => {
    const changes = await routePromote([onlyInCommon.elemID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(0)
  })

  it('should route a nested field attr where the object does not exists in common', async () => {
    const annoID = onlyInEnvObj.fields.str.elemID.createNestedID('anno')
    const changes = await routePromote([annoID], primarySrcName, commonSrc, trackEnvSources)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[secSrcName]).toHaveLength(0)
    expect(changes.envSources?.[primarySrcName][0].id).toEqual(annoID)
    expect(changes.commonSource?.[0].id).toEqual(onlyInEnvObj.elemID)
  })
})

describe('untrack', () => {
  const onlyInCommon = new ObjectType({
    elemID: new ElemID('salto', 'onlyInCommonObj'),
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      envField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
    annotationRefsOrTypes: {
      env: BuiltinTypes.STRING,
    },
    annotations: {
      env: 'ENV',
      split: {
        env: 'ENV',
      },
    },
  })

  const splitObjCommon = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      commonField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
    annotationRefsOrTypes: {
      common: BuiltinTypes.STRING,
    },
    annotations: {
      common: 'COMMON',
      split: {
        common: 'COMMON',
      },
    },
  })

  const missingFromPrimCommon = new InstanceElement('missingPrim', onlyInCommon, {
    common: 'COMMON',
  })

  const missingFromPrimSec = new InstanceElement('missingPrim', onlyInCommon, {
    sec: 'SEC',
  })

  const multiFileCommon = new InstanceElement('multiFile', onlyInCommon, {
    default: 'DEAFULT',
    other: 'OTHER',
  })

  const multiFileCommonDefault = new InstanceElement('multiFile', onlyInCommon, {
    default: 'DEAFULT',
  })

  const multiFileCommonOther = new InstanceElement('multiFile', onlyInCommon, {
    other: 'OTHER',
  })

  const primaryElements = [splitObjEnv]
  const secondaryElements = [splitObjEnv, missingFromPrimSec]
  const commonElements = [onlyInCommon, splitObjCommon, missingFromPrimCommon, multiFileCommon]

  const primarySrc = createMockNaclFileSource(primaryElements, {
    'default.nacl': primaryElements,
  })
  const commonSrc = createMockNaclFileSource(commonElements, {
    'default.nacl': [onlyInCommon, splitObjCommon, missingFromPrimCommon, multiFileCommonDefault],
    'other.nacl': [multiFileCommonOther],
  })
  const untrackEnvSource = {
    [primarySrcName]: primarySrc,
    [secSrcName]: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should throw the proper error when trying to move an element which is not in the origin env', async () => {
    await expect(routeDemote([ElemID.fromFullName('salto.noop')], commonSrc, untrackEnvSource)).rejects.toThrow(
      'does not exist in origin',
    )
  })

  it('should move add element which is only in common to all envs', async () => {
    const changes = await routeDemote([onlyInCommon.elemID], commonSrc, untrackEnvSource)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toEqual(changes.envSources?.[secSrcName])
    expect(
      hasChanges(changes.envSources?.[primarySrcName] ?? [], [{ action: 'add', id: onlyInCommon.elemID }]),
    ).toBeTruthy()
  })

  it('should create detailed changes for elements which are in common and have env fragments', async () => {
    const changes = await routeDemote([splitObjEnv.elemID], commonSrc, untrackEnvSource)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(5)
    expect(changes.envSources?.[secSrcName]).toHaveLength(5)
    expect(changes.envSources?.[primarySrcName]).toEqual(changes.envSources?.[secSrcName])
    expect(
      hasChanges(changes.envSources?.[primarySrcName] ?? [], [
        { action: 'add', id: splitObjCommon.elemID.createNestedID('annotation', 'common') },
        { action: 'add', id: splitObjCommon.elemID.createNestedID('attr', 'split', 'common') },
        { action: 'add', id: splitObjCommon.elemID.createNestedID('attr', 'common') },
        { action: 'add', id: splitObjCommon.fields.commonField.elemID },
        { action: 'add', id: splitObjCommon.fields.splitField.elemID.createNestedID('common') },
      ]),
    ).toBeTruthy()
  })

  it('should create a different set of detailed changes accodrding the data in the actual env', async () => {
    const changes = await routeDemote([missingFromPrimCommon.elemID], commonSrc, untrackEnvSource)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    expect(
      hasChanges(changes.envSources?.[primarySrcName] ?? [], [{ action: 'add', id: missingFromPrimCommon.elemID }]),
    ).toBeTruthy()
    expect(
      hasChanges(changes.envSources?.[secSrcName] ?? [], [
        { action: 'add', id: missingFromPrimCommon.elemID.createNestedID('common') },
      ]),
    ).toBeTruthy()
  })

  it('should wrap nested ids if the target env does not have the top level element', async () => {
    const changes = await routeDemote([onlyInCommon.elemID.createNestedID('attr', 'str')], commonSrc, untrackEnvSource)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(1)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toEqual(changes.envSources?.[secSrcName])
    expect(
      hasChanges(changes.envSources?.[primarySrcName] ?? [], [{ action: 'add', id: onlyInCommon.elemID }]),
    ).toBeTruthy()
  })

  it('should maitain file structure', async () => {
    const changes = await routeDemote([multiFileCommon.elemID], commonSrc, untrackEnvSource)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.envSources?.[primarySrcName]).toHaveLength(2)
    expect(changes.envSources?.[secSrcName]).toHaveLength(2)
    expect(changes.envSources?.[primarySrcName]).toEqual(changes.envSources?.[secSrcName])
    expect(changes.envSources?.[primarySrcName]).toEqual([
      { action: 'add', id: multiFileCommon.elemID, path: ['default'], data: { after: multiFileCommonDefault } },
      { action: 'add', id: multiFileCommon.elemID, path: ['other'], data: { after: multiFileCommonOther } },
    ])
  })
})

describe('copyTo', () => {
  const onlyInEnv1Obj = new ObjectType({
    elemID: new ElemID('salto', 'onlyInEnvObj'),
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv1 = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      e1Field: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
  })

  const splitObjEnv2 = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      e2Field: {
        refType: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
  })

  const multiFileInstaceDefault = new InstanceElement('split', onlyInEnv1Obj, {
    default: 'DEFAULT',
  })
  const multiFileInstaceOther = new InstanceElement('split', onlyInEnv1Obj, {
    other: 'OTHER',
  })
  const multiFileInstace = new InstanceElement('split', onlyInEnv1Obj, {
    other: 'OTHER',
    default: 'DEFAULT',
  })

  const inSecObject = new ObjectType({
    elemID: new ElemID('salto', 'inSec'),
  })
  const primaryElements = [onlyInEnv1Obj, splitObjEnv1, multiFileInstace, inSecObject]
  const secondaryElements = [splitObjEnv2, inSecObject]

  const primarySrc = createMockNaclFileSource(primaryElements, {
    'default.nacl': [onlyInEnv1Obj, splitObjEnv1, multiFileInstaceDefault, inSecObject],
    'other.nacl': [multiFileInstaceOther],
  })
  const secondarySources = {
    [secSrcName]: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should throw the proper error when trying to move an element which is not in the origin env', async () => {
    await expect(routeCopyTo([ElemID.fromFullName('salto.noop')], primarySrc, secondarySources)).rejects.toThrow(
      'does not exist in origin',
    )
  })

  it('should copy an entire element which does not exist in the target env', async () => {
    const changes = await routeCopyTo([onlyInEnv1Obj.elemID], primarySrc, secondarySources)
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    const secondaryChange = changes.envSources?.[secSrcName] && changes.envSources?.[secSrcName][0]
    expect(secondaryChange?.id).toEqual(onlyInEnv1Obj.elemID)
    expect(secondaryChange?.action).toEqual('add')
    expect(secondaryChange?.data).toEqual({ after: onlyInEnv1Obj })
  })

  it('should create detailed changes when an element fragment is present in the target env', async () => {
    const changes = await routeCopyTo([splitObjEnv1.elemID], primarySrc, secondarySources)
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(4)
    expect(
      hasChanges(changes.envSources?.[secSrcName] || [], [
        { action: 'remove', id: splitObjEnv2.fields.e2Field.elemID },
        { action: 'add', id: splitObjEnv1.fields.e1Field.elemID },
        { action: 'remove', id: splitObjEnv2.fields.splitField.elemID.createNestedID('common') },
        { action: 'add', id: splitObjEnv2.fields.splitField.elemID.createNestedID('env') },
      ]),
    ).toBeTruthy()
  })

  it('should wrap nested ids in an object when copying nested ids of an element with no fragment in the target env', async () => {
    const changes = await routeCopyTo(
      [onlyInEnv1Obj.fields.str.elemID, onlyInEnv1Obj.elemID.createNestedID('attr', 'str')],
      primarySrc,
      secondarySources,
    )
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    expect(
      hasChanges(changes.envSources?.[secSrcName] || [], [{ action: 'add', id: onlyInEnv1Obj.elemID }]),
    ).toBeTruthy()
  })

  it('should add nested fields for existing objects', async () => {
    const changes = await routeCopyTo([splitObjEnv1.fields.e1Field.elemID], primarySrc, secondarySources)
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(1)
    expect(
      hasChanges(changes.envSources?.[secSrcName] || [], [{ action: 'add', id: splitObjEnv1.fields.e1Field.elemID }]),
    ).toBeTruthy()
  })

  it('should maintain file structure when copying an element to target env', async () => {
    const changes = await routeCopyTo([multiFileInstace.elemID], primarySrc, secondarySources)
    expect(changes.envSources?.[primarySrcName] ?? []).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.envSources?.[secSrcName]).toHaveLength(2)
    expect(changes.envSources?.[secSrcName]).toEqual([
      { action: 'add', id: multiFileInstace.elemID, path: ['default'], data: { after: multiFileInstaceDefault } },
      { action: 'add', id: multiFileInstace.elemID, path: ['other'], data: { after: multiFileInstaceOther } },
    ])
  })
})

describe('routeRemoveFrom', () => {
  const existingElemID = new ElemID('salto', 'exists')
  const notExistingElemID = new ElemID('salto', 'notExists')
  const existingObject = new ObjectType({ elemID: existingElemID })

  it('should return the removal changes as secondary when env name is passed', async () => {
    const changes = await routeRemoveFrom(
      [existingElemID, notExistingElemID],
      createMockNaclFileSource([existingObject]),
      'env',
    )
    expect(changes).toEqual({
      commonSource: [],
      envSources: {
        env: [
          {
            action: 'remove',
            id: existingElemID,
            path: undefined,
            data: { before: existingObject },
          },
        ],
      },
    })
  })

  it('should return the removal changes as primary when no env name was passed', async () => {
    const srcName = 'src'
    const changes = await routeRemoveFrom(
      [existingElemID, notExistingElemID],
      createMockNaclFileSource([existingObject]),
      srcName,
    )
    expect(changes).toEqual({
      commonSource: [],
      envSources: {
        [srcName]: [
          {
            action: 'remove',
            id: existingElemID,
            path: undefined,
            data: { before: existingObject },
          },
        ],
      },
    })
  })
})

describe('getMergeableParentID', () => {
  const primitive = new PrimitiveType({
    elemID: new ElemID('salto', 'prim'),
    primitive: PrimitiveTypes.STRING,
  })

  const object = new ObjectType({
    elemID: new ElemID('salto', 'obj'),
    fields: {
      data: {
        refType: BuiltinTypes.UNKNOWN,
        annotations: {
          obj: {
            key: 'value',
          },
          list: [
            {
              list: [
                {
                  key: 'value',
                },
              ],
            },
          ],
        },
      },
    },
    annotations: {
      obj: {
        key: 'value',
      },
      list: [
        {
          list: [
            {
              key: 'value',
            },
          ],
        },
      ],
      '007': [
        {
          '007': [
            {
              key: 'value',
            },
          ],
        },
      ],
      49: {
        key: 'value',
      },
    },
  })

  const instance = new InstanceElement('inst', object, {
    data: {
      obj: {
        key: 'value',
      },
      list: [
        {
          list: [
            {
              key: 'value',
            },
          ],
        },
      ],
    },
  })

  describe('for top level objects', () => {
    it('should return the original id', () => {
      expect(getMergeableParentID(primitive.elemID, [primitive]).mergeableID).toEqual(primitive.elemID)
      expect(getMergeableParentID(instance.elemID, [instance]).mergeableID).toEqual(instance.elemID)
      expect(getMergeableParentID(object.elemID, [object]).mergeableID).toEqual(object.elemID)
    })
  })

  describe('in an instance id', () => {
    it('should return the original id if the path id is mergeable', () => {
      const mergeableID = instance.elemID.createNestedID('obj', 'key')
      const res = getMergeableParentID(mergeableID, [instance]).mergeableID
      expect(res).toEqual(mergeableID)
    })

    it('should return the highest level non mergeable id', () => {
      const mergeableID = instance.elemID.createNestedID('data', 'list')
      const res = getMergeableParentID(mergeableID.createNestedID('0', 'list', '0'), [instance]).mergeableID
      expect(res).toEqual(mergeableID)
    })
  })

  describe('in an object type field', () => {
    it('should return the original id if the path id is mergeable', () => {
      const mergeableID = object.fields.data.elemID.createNestedID('obj', 'key')
      const res = getMergeableParentID(mergeableID, [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })

    it('should return the highest level non mergeable id', () => {
      const mergeableID = object.fields.data.elemID.createNestedID('list')
      const res = getMergeableParentID(mergeableID.createNestedID('0', 'list', '0'), [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })
  })

  describe('in annotation values', () => {
    it('should return the original id if the path id is mergeable', () => {
      const mergeableID = object.elemID.createNestedID('attr', 'obj', 'key')
      const res = getMergeableParentID(mergeableID, [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })

    it('should return the highest level non mergeable id', () => {
      const mergeableID = object.elemID.createNestedID('attr', 'list')
      const res = getMergeableParentID(mergeableID.createNestedID('0', 'list', '0'), [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })
  })

  describe('when attr names are numbers', () => {
    it('should return the original id if the path id is mergeable', () => {
      const mergeableID = object.elemID.createNestedID('attr', '49', 'key')
      const res = getMergeableParentID(mergeableID, [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })

    it('should return the highest level non mergeable id', () => {
      const mergeableID = object.elemID.createNestedID('attr', '007')
      const res = getMergeableParentID(mergeableID.createNestedID('0', '007', '0'), [object]).mergeableID
      expect(res).toEqual(mergeableID)
    })
  })
})
