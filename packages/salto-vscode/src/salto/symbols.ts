import { EditorRange, PositionContext } from './context'

export enum SaltoSymbolKind {
  File,
  Type,
  Field,
  Array,
  Instance,
  Annotation,
  Attribute
}

export interface SaltoSymbol {
  name: string
  type: SaltoSymbolKind
  range: EditorRange
}

const getSaltoSymbolName = (context: PositionContext, prefName?: string): string => {
  if (context.ref) {
    const fullName = context.ref.path
      ? context.ref.path
      : context.ref.element.elemID.name
    if (prefName && fullName.indexOf(prefName) >= 0) {
      const partName = fullName.slice(fullName.indexOf(prefName) + prefName.length + 1)
      return Number.isNaN(Number(partName)) ? partName : `[${partName}]`
    }
    return fullName
  }
  return 'global'
}

const getSaltoSymbolKind = (context: PositionContext): SaltoSymbolKind => {
  if (context.ref && context.ref.isList) return SaltoSymbolKind.Array
  if (context.type === 'field') {
    return (context.ref && context.ref.path)
      ? SaltoSymbolKind.Annotation
      : SaltoSymbolKind.Field
  }
  if (context.type === 'instance') {
    return (context.ref && context.ref.path)
      ? SaltoSymbolKind.Attribute
      : SaltoSymbolKind.Instance
  }
  if (context.type === 'type') {
    return (context.ref && context.ref.path)
      ? SaltoSymbolKind.Annotation
      : SaltoSymbolKind.Type
  }
  return SaltoSymbolKind.File
}

export const createSaltoSymbol = (
  context: PositionContext,
): SaltoSymbol => {
  const name = context.parent
    ? getSaltoSymbolName(context, getSaltoSymbolName(context.parent))
    : getSaltoSymbolName(context)
  const type = getSaltoSymbolKind(context)
  return { name, type, range: context.range }
}
