import { AdditionDiff } from '@salto/dag'
import { Element, ElemID, ObjectType, InstanceElement, getChangeElement, Value, Field, isObjectType, isInstanceElement, PrimitiveType, isField } from 'adapter-api'
import _ from 'lodash'
import { DetailedChange } from 'index'
import { ElementsSource } from 'src/workspace/elements_source'

type DetailedAddition = AdditionDiff<Value> & {
	id: ElemID
	path: string[]
}

const addToField = (
  addition: DetailedAddition, 
  commonField: Field, 
  currentField?: Field
): Field => {
  if (isField(addition.data.after)) return addition.data.after
  const name = commonField.name
  const {parent, path} = addition.id.createTopLevelParentID()
  const annotations = { ...currentField?.annotations } || {}
  if (!_.isEmpty(path)) {
    _.set(annotations, path.slice(1), addition.data.after)
  }
  return new Field(parent, name, commonField.type, annotations)
}

const createObjectTypeFromNestedAdditions = (
  additions: DetailedAddition[],
  commonObjectType: ObjectType,
): ObjectType =>
  new ObjectType(additions.reduce((prev, addition) => {
    switch (addition.id.idType) {
      case 'field': 
      const fieldName = addition.id.createTopLevelParentID().path[0]
      return { ...prev,
        fields: {
          ...prev.fields,
          [fieldName]: addToField(
            addition,
            commonObjectType.fields[fieldName], 
            prev.fields[fieldName]
          ),
        } }
      case 'attr': 
        const attrPath = addition.id.createTopLevelParentID().path
        return { ...prev,
        annotations: _.set({ ...prev.annotations}, attrPath, addition.data.after)
      }
      case 'annotation':  
        const annoName = addition.id.createTopLevelParentID().path[0]
        return { ...prev,
        annotationTypes: {
          ...prev.annotationTypes,
          [annoName]: addition.data.after,
        } }
      default: return prev
    }
  }, {
  elemID: commonObjectType.elemID,
  fields: {} as Record<string, Field>,
  annotationTypes: {},
  annotations: {},
  path: additions[0].path
}))

const createInstanceElementFromNestedAdditions = (
  additions: DetailedAddition[],
  commonInstance: InstanceElement,
): InstanceElement => {
  const value = {}
  additions.forEach(addition => {
    const inValuePath = addition.id.createTopLevelParentID().path
    const valueToAdd = getChangeElement(addition)
    _.set(value, inValuePath, valueToAdd)
  })
  return new InstanceElement(commonInstance.elemID.name, commonInstance.type, value, additions[0].path)
}

const createPrimitiveTypeFromNestedAdditions = (
  additions: DetailedAddition[],
  commonPrimitiveType: PrimitiveType,
) : PrimitiveType =>  new PrimitiveType(additions.reduce((prev, addition) => {
    switch (addition.id.idType) {
      case 'attr': return { ...prev,
        annotations: {
          ...prev.annotations,
          [addition.id.name]: addition.data.after,
        } }
      case 'annotation': return { ...prev,
        annotationTypes: {
          ...prev.annotationTypes,
          [addition.id.name]: addition.data.after,
        } }
      default: return prev
    }
  }, {
  elemID: commonPrimitiveType.elemID,
  primitive: commonPrimitiveType.primitive,
  annotationTypes: {},
  annotations: {},
  path: additions[0].path
}))

const wrapAdditionElement = (
  additions: DetailedAddition[],
  commonElement: Element,
) : Element => {
  if (isObjectType(commonElement)) {
    return createObjectTypeFromNestedAdditions(
      additions, 
      commonElement, 
    )
  }
  if (isInstanceElement(commonElement)) {
    return createInstanceElementFromNestedAdditions(
      additions, 
      commonElement, 
    )
  }
  return createPrimitiveTypeFromNestedAdditions(
    additions,
    commonElement as PrimitiveType,
  )
}

const wrapAdditions = (
  nestedAdditions: DetailedAddition[], 
  commonElement: Element,
): DetailedAddition => {

  const refAddition = nestedAdditions[0]
  const wrapperElement = wrapAdditionElement(nestedAdditions, commonElement)
	return {
	  action: 'add',
	  id: wrapperElement.elemID,
	  path: refAddition.path,
	  data: {
		  after: wrapperElement as Element,
	  },
  } as DetailedAddition
}

export const createUpdateChanges = async (
  changes: DetailedChange[],
  commonSource: ElementsSource,
  targetSource: ElementsSource
): Promise<DetailedChange[]> => {
  const nestedAdditions = []
  const otherChanges = []
  for (const change of changes) {
    if (change.action === 'add' 
      && change.id.nestingLevel > 0 
      && ! (await targetSource.get(change.id.createTopLevelParentID().parent))){
        nestedAdditions.push(change)
    }
    else {
      otherChanges.push(change)
    }
  } 
  const modifiedAdditions = await Promise.all(_(nestedAdditions)
    .groupBy(addition => addition.id.createTopLevelParentID().parent.getFullName())
    .entries()
    .map(async ([parentID, elementAdditions]) => {
      const commonElement = await commonSource.get(ElemID.fromFullName(parentID))
      const targetElement = await targetSource.get(ElemID.fromFullName(parentID))
      if (commonElement && !targetElement) {
        return wrapAdditions(elementAdditions as DetailedAddition[], commonElement)
      }
      return elementAdditions
    })
    .value())
  return [
    ... otherChanges,
    ... _.flatten(modifiedAdditions)
  ]
} 