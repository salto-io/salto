import { EditorRange, PositionContext } from './context'

export enum SymbolKind {
  File,
  Type,
  Field,
  Array,
  Instance,
  Annotation,
  Attribute
}

interface Symbol {
  name: string
  type: SymbolKind
  range: EditorRange
}

const getSymbolName = (context: PositionContext, prefName?: string): string => {
  if (context.ref) {
    const fullName = context.ref.path
      ? context.ref.path
      : context.ref.element.elemID.getFullName()
    if (prefName && fullName.indexOf(prefName) >= 0) {
      const partName = fullName.slice(fullName.indexOf(prefName) + prefName.length + 1)
      return Number.isNaN(Number(partName)) ? partName : `[${partName}]`
    }
    return fullName
  }
  return 'global'
}

const getSymbolKind = (context: PositionContext): SymbolKind => {
  if (context.ref && context.ref.isList) return SymbolKind.Array
  if (context.type === 'field') {
    return (context.ref && context.ref.path)
      ? SymbolKind.Annotation
      : SymbolKind.Field
  }
  if (context.type === 'instance') {
    return (context.ref && context.ref.path)
      ? SymbolKind.Attribute
      : SymbolKind.Instance
  }
  if (context.type === 'type') {
    return (context.ref && context.ref.path)
      ? SymbolKind.Annotation
      : SymbolKind.Type
  }
  return SymbolKind.File
}

export const createSymbol = (
  context: PositionContext,
): Symbol => {
  const name = context.parent
    ? getSymbolName(context, getSymbolName(context.parent))
    : getSymbolName(context)
  const type = getSymbolKind(context)
  return { name, type, range: context.range }
}
