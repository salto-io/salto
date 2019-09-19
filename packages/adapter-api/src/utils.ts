import _ from 'lodash'
import {
  isObjectType, Type, Field, ObjectType, ElemID,
} from './elements'

interface AnnoRef {
  annoType?: Type
  annoName?: string
}

export const getField = (baseType: Type, pathParts: string[]): Field|undefined => {
  // This is a little tricky. Since many fields can have _ in them,
  // and we can't tell of the _ is path separator or a part of the
  // the path name. As long as path is not empty we will try to advance
  // in the recursion in two ways - First we try only the first token.
  // If it fails, we try to first to tokens (the recursion will take)
  // care of the next "join"
  const [curPart, ...restOfParts] = pathParts
  if (_.isEmpty(curPart) || !isObjectType(baseType)) {
    return undefined
  }

  if (baseType.fields[curPart]) {
    return _.isEmpty(restOfParts) ? baseType.fields[curPart]
      : getField(baseType.fields[curPart].type, restOfParts)
  }
  // First token is no good, we check if it is a part of a longer name
  const nextCur = [curPart, restOfParts[0]].join(ElemID.NAMESPACE_SEPERATOR)
  const nextRest = restOfParts.slice(1)
  return getField(baseType, [nextCur, ...nextRest])
}

export const getFieldType = (baseType: Type, pathParts: string[]): Type|undefined => {
  const field = getField(baseType, pathParts)
  return (field) ? field.type : undefined
}

export const getFieldNames = (refType: ObjectType, path: string): string[] => {
  if (!path) {
    return _.keys(refType.fields)
  }
  const pathField = getField(refType, path.split(ElemID.NAMESPACE_SEPERATOR))
  if (pathField && isObjectType(pathField.type)) {
    return _.keys(pathField.type.fields)
  }
  return []
}

export const getAnnotationKey = (annotations: {[key: string]: Type}, path: string): AnnoRef => {
  // Looking for the longest key in annotations that start with pathParts
  const annoName = _(annotations).keys().filter(k => path.startsWith(k))
    .sortBy(k => k.length)
    .last()
  const annoType = (annoName) ? annotations[annoName] : undefined
  return { annoName, annoType }
}
