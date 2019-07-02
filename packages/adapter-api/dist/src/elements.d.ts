/**
 * Defines the list of supported types.
 */
export declare enum PrimitiveTypes {
    STRING = 0,
    NUMBER = 1,
    BOOLEAN = 2,
    OBJECT = 3,
    LIST = 4
}
export interface Values {
    [key: string]: any;
}
declare type TypeMap = Record<string, Type>;
interface TypeIDArgs {
    adapter?: string;
    name?: string;
}
export declare class TypeID {
    static readonly NAMESPACE_SEPERATOR = "_";
    name?: string;
    adapter?: string;
    constructor(args: TypeIDArgs);
    getFullName(): string;
}
/**
 * An abstract class that represent the base type.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
export declare abstract class Type {
    static DEFAULT: string;
    readonly typeID: TypeID;
    annotations: TypeMap;
    annotationsValues: Values;
    constructor({ annotations, annotationsValues, typeID, }: {
        typeID: TypeID;
        annotations: TypeMap;
        annotationsValues: Values;
    });
    /**
     * Return a deep copy of the instance annotations by recursivally
     * cloning all annotations (by invoking their clone method)
     */
    protected cloneAnnotations(): TypeMap;
    /**
     * Return a deep copy of the instance annotations values.
     */
    protected cloneAnnotationsValues(): Values;
    protected annotate(annotationsValues: Values): void;
    /**
     * Return an independent copy of this instance. Needs to be implemented
     * by each subclass as this is structure dependent.
     * @return {Type} the cloned instance
     */
    abstract clone(annotationsValues?: Values): Type;
}
/**
 * Defines a type that represents a primitive value (This comment WAS NOT auto generated)
 */
export declare class PrimitiveType extends Type {
    primitive: PrimitiveTypes;
    constructor({ typeID, primitive, annotations, annotationsValues, }: {
        typeID: TypeID;
        primitive: PrimitiveTypes;
        annotations?: TypeMap;
        annotationsValues?: Values;
    });
    /**
     * Return an independent copy of this instance.
     * @return {PrimitiveType} the cloned instance
     */
    clone(additionalAnnotationsValues?: Values): PrimitiveType;
}
/**
 * Defines a type that represents an object (Also NOT auto generated)
 */
export declare class ObjectType extends Type {
    fields: TypeMap;
    constructor({ typeID, fields, annotations, annotationsValues, }: {
        typeID: TypeID;
        fields?: TypeMap;
        annotations?: TypeMap;
        annotationsValues?: Values;
    });
    private cloneFields;
    /**
     * Return an independent copy of this instance.
     * @return {ObjectType} the cloned instance
     */
    clone(additionalAnnotationsValues?: Values): ObjectType;
}
/**
 * Defines a type that represents an array (OK I DID copy paste from prev comments.)
 */
export declare class ListType extends Type {
    elementType?: Type;
    constructor({ typeID, elementType, annotations, annotationsValues, }: {
        typeID: TypeID;
        elementType?: Type;
        annotations?: TypeMap;
        annotationsValues?: Values;
    });
    /**
     * Return an independent copy of this instance.
     * @return {ListType} the cloned instance
     */
    clone(additionalAnnotationsValues?: Values): ListType;
}
export declare class TypesRegistry {
    registeredTypes: TypeMap;
    constructor(initTypes?: Type[]);
    registerType(typeToRegister: Type): void;
    hasType(typeID: TypeID): boolean;
    getAllTypes(): Type[];
    getType(typeID: TypeID, type?: PrimitiveTypes): any;
    merge(otherRegistry: TypesRegistry): TypesRegistry;
}
export declare function isObjectType(element: any): element is ObjectType;
export declare function isListType(element: any): element is ListType;
export declare function isPrimitiveType(element: any): element is PrimitiveType;
export {};
