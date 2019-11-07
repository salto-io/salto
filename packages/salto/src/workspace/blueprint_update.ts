import _ from 'lodash'
import path from 'path'
import { getChangeElement, isElement } from 'adapter-api'

import { logger } from '@salto/logging'
import { DetailedChange } from '../core/plan'
import { SourceRange } from '../parser/parse'
import { dump as saltoDump } from '../parser/dump'

const log = logger(module)

type DetailedChangeWithSource = DetailedChange & { location: SourceRange }

export const getChangeLocations = (
  change: DetailedChange,
  sourceMap: ReadonlyMap<string, SourceRange[]>,
): DetailedChangeWithSource[] => {
  const lastNestedLocation = (parentScope: SourceRange): SourceRange => {
    // We want to insert just before the scope's closing bracket, so we place the change
    // one byte before the closing bracket.
    // We also want one indentation level into the scope so we take the starting column + 2
    const nestedPosition = {
      line: parentScope.end.line,
      col: parentScope.start.col + 2,
      byte: parentScope.end.byte - 1,
    }
    return {
      filename: parentScope.filename,
      start: nestedPosition,
      end: nestedPosition,
    }
  }
  const findLocations = (): SourceRange[] => {
    if (change.action !== 'add') {
      // We want to get the location of the existing element
      const possibleLocations = sourceMap.get(change.id.getFullName()) || []
      if (change.action === 'remove') {
        return possibleLocations
      }
      if (possibleLocations.length > 0) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return [possibleLocations[0]]
      }
    } else {
      // We add new values / elements as the last part of a parent scope unless the parent scope
      // is a config element
      const parentID = change.id.createParentID()
      const possibleLocations = sourceMap.get(parentID.getFullName()) || []
      if (possibleLocations.length > 0 && !parentID.isConfig()) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return [lastNestedLocation(possibleLocations[0])]
      }
    }
    // Fallback to using the path from the element itself
    const elemPath = path.join(...(getChangeElement(change).path || ['unsorted']))
    return [{
      filename: `${elemPath}.bp`,
      start: { col: 1, line: 1, byte: 0 },
      end: { col: 1, line: 1, byte: 0 },
    }]
  }

  return findLocations().map(location => ({ ...change, location }))
}

const indent = (data: string, indentLevel: number, newValue: boolean): string => {
  const indentLines = (lines: string[], level: number): string[] => (
    lines.map(line => _.repeat(' ', level) + line)
  )
  const lines = data.split('\n')

  if (indentLevel > 0 && newValue && lines.length > 1) {
    // New values start one character before the closing bracket of the scope.
    // That means the first line needs only one level of indentation.
    // It also means the empty line at the end needs to re-create the original indentation
    // (so that the closing bracket doesn't move), so the last line should be indented
    // one level less
    return [
      ...indentLines(lines.slice(0, 1), 2),
      ...indentLines(lines.slice(1, -1), indentLevel),
      ...indentLines(lines.slice(-1), indentLevel - 2),
    ].join('\n')
  }
  // If this is not a new value we are at the original value's start position so we don't have
  // to indent the first line
  return [
    ...lines.slice(0, 1),
    ...indentLines(lines.slice(1), indentLevel),
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
      const changeKey = change.id.nameParts.slice(-1)[0]
      const isListElement = changeKey.match(/^\d+$/) !== null
      if (isElement(elem) || isListElement) {
        // elements and list values do not need to be serialized with their key
        newData = await saltoDump(elem)
      } else {
        // When dumping values (attributes) we need to dump the key as well
        newData = await saltoDump({ [changeKey]: elem })
        // We need a leading line break if we are in an empty scope (otherwise we get values
        // in the same line as the opening bracket), since finding out whether we are in an empty
        // scope isn't easy and adding a line break where we don't need it doesn't actually do
        // harm, we add the leading line break anyway
        newData = `\n${newData}`
      }
      if (change.action === 'modify' && newData.slice(-1)[0] === '\n') {
        // Trim trailing newline (the original value already has one)
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

  log.debug(`going to calcaulate buffer changes for ${changes.length} changes`)
  const bufferChanges = await Promise.all(changes.map(toBufferChange))
  log.debug(`got ${bufferChanges.length} buffer changes`)
  // We want to replace buffers from last to first, that way we won't have to re-calculate
  // the source locations after every change
  const sortedChanges = _.sortBy(bufferChanges, change => change.start).reverse()
  const ret = sortedChanges.reduce(replaceBufferPart, currentData)
  log.debug(`updated string length is ${ret.length}`)
  return ret
}
