import _ from 'lodash'
import path from 'path'
import { getChangeElement, isElement } from 'adapter-api'

import { DetailedChange } from '../core/plan'
import { SourceRange } from '../parser/parse'
import { dump } from '../parser/dump'

type DetailedChangeWithSource = DetailedChange & { location: SourceRange }

export const addChangeLocation = (
  change: DetailedChange,
  sourceMap: ReadonlyMap<string, SourceRange[]>,
): DetailedChangeWithSource => {
  const lastNestedLocation = (parentScope: SourceRange): SourceRange => {
    const nestedPosition = {
      line: parentScope.end.line - 1,
      col: parentScope.start.col + 2,
      byte: parentScope.end.byte - 1,
    }
    return {
      filename: parentScope.filename,
      start: nestedPosition,
      end: nestedPosition,
    }
  }
  const getChangeLocation = (): SourceRange => {
    if (change.action !== 'add') {
      // We want to get the location of the existing element
      const possibleLocations = sourceMap.get(change.id.getFullName()) || []
      if (possibleLocations.length > 0) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return possibleLocations[0]
      }
    } else {
      // We add new values / elements as the last part of a parent scope
      const possibleLocations = sourceMap.get(change.id.createParentID().getFullName()) || []
      if (possibleLocations.length > 0) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return lastNestedLocation(possibleLocations[0])
      }
    }
    // Fallback to using the path from the element itself
    const elemPath = path.join(...(getChangeElement(change).path || ['unsorted']))
    return {
      filename: `${elemPath}.bp`,
      start: { col: 1, line: 1, byte: 0 },
      end: { col: 1, line: 1, byte: 0 },
    }
  }

  return { ...change, location: getChangeLocation() }
}

const indent = (data: string, indentLevel: number, newValue: boolean): string => {
  const lines = data.split('\n')
  if (indentLevel > 0 && newValue && lines.length > 1) {
    // New values start one character before the closing bracket of the scope.
    // That means the first line needs only one level of indentation.
    // It also means the empty line at the end needs to re-create the original indentation
    // (so that the closing bracket doesn't move), so the last line should be indented
    // one level less
    return [
      ...lines.slice(0, 1).map(l => `  ${l}`),
      ...lines.slice(1, -1).map(l => _.repeat(' ', indentLevel) + l),
      ...lines.slice(-1).map(l => _.repeat(' ', indentLevel - 2) + l),
    ].join('\n')
  }
  // If this is not a new value we are at the original value's start position so we don't have
  // to indent the first line
  return [
    ...lines.slice(0, 1),
    ...lines.slice(1).map(l => _.repeat(' ', indentLevel) + l),
  ].join('\n')
}

export const updateBlueprintData = async (
  currentData: string,
  changes: DetailedChangeWithSource[]
): Promise<string> => {
  type BufferChange = {
    newData: string
    start: number
    end: number
  }
  const toBufferChange = async (change: DetailedChangeWithSource): Promise<BufferChange> => {
    const elem = change.action === 'remove' ? undefined : change.data.after
    let newData: string
    if (elem !== undefined) {
      if (isElement(elem)) {
        newData = await dump(elem)
      } else {
        // When dumping values (attributes) we need to dump the key as well
        newData = await dump({ [change.id.nameParts.slice(-1)[0]]: elem })
        // We need a leading line break if we are in an empty scope (otherwise we get values
        // in the same line as the opening bracket), since finding out whether we are in an empty
        // scope isn't easy and adding a line break where we don't need it doesn't actually do
        // harm, we add the leading line break anyway
        newData = `\n${newData}`
      }
      if (change.action === 'modify') {
        // Trim trainling newline (the original value already has one)
        newData = newData.slice(0, -1)
      }
      newData = indent(newData, change.location.start.col - 1, change.action === 'add')
    } else {
      // This is a removal, we want to replace the original content with an empty string
      newData = ''
    }
    return { newData, start: change.location.start.byte, end: change.location.end.byte }
  }

  const replaceBufferPart = (data: string, change: BufferChange): string => (
    data.slice(0, change.start) + change.newData + data.slice(change.end)
  )

  const bufferChanges = await Promise.all(changes.map(toBufferChange))
  // We want to replace buffers from last to first, that way we won't have to re-calculate
  // the source locations after every change
  const sortedChanges = _.sortBy(bufferChanges, change => change.start).reverse()
  return sortedChanges.reduce(replaceBufferPart, currentData)
}
