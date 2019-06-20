package main

import (
	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
	"github.com/zclconf/go-cty/cty"
)

// convertValue converts a cty.Value to the appropriate go native type
func convertValue(val cty.Value) interface{} {
	t := val.Type()
	switch {
	case t.IsTupleType():
		res := make([]interface{}, val.LengthInt())
		var i int64
		for i = 0; i < int64(val.LengthInt()); i++ {
			res[i] = convertValue(val.Index(cty.NumberIntVal(i)))
		}
		return res

	case t.IsObjectType():
		res := map[string]interface{}{}
		for k, v := range val.AsValueMap() {
			res[k] = convertValue(v)
		}
		return res

	case t.IsPrimitiveType():
		switch t {
		case cty.String:
			return val.AsString()
		case cty.Number:
			res, _ := val.AsBigFloat().Float64()
			return res
		case cty.Bool:
			return val.True()
		default:
			panic("unknown cty primitve type: " + t.FriendlyName())
		}

	// We should never get the following types from parsing since they will be parsed as less specific types
	// see https://github.com/hashicorp/hcl2/blob/master/hcl/hclsyntax/spec.md#collection-values
	case t.IsListType():
		panic("lists are not expected here - we expect to get tuple type instead")
	case t.IsMapType():
		panic("maps are not expected here - we expect to get an object type instead")
	}

	panic("unknown type to convert: " + t.FriendlyName())
	return nil
}

// hclConverter walks the HCL tree and converts each node to a native go
// value that can be serialized to javascript later
type hclConverter struct {
	path    string
	JSValue map[string]interface{}

	nestedConverter *hclConverter
}

func newHclConverter(path string) *hclConverter {
	return &hclConverter{
		path:            path,
		JSValue:         map[string]interface{}{},
		nestedConverter: nil,
	}
}

func (maker *hclConverter) Enter(node hclsyntax.Node) hcl.Diagnostics {
	if maker.nestedConverter != nil {
		// Let deepest nested maker handle the new element
		return maker.nestedConverter.Enter(node)
	}

	switch node.(type) {
	case *hclsyntax.Body:
		// Initialize attrs and blocks
		maker.JSValue["attrs"] = map[string]interface{}{}
		maker.JSValue["blocks"] = []interface{}{}

	case hclsyntax.Attributes:
		// This just means we are entering the attributes list, not much to do with it since
		// we will know we are in an attribute when we get one

	case *hclsyntax.Attribute:
		// Starting to parse an attribute, currently the nested converter doesn't really do
		// anything besides marking that we expect more nodes inside the attribute.
		// In the future if we parse the expressions themselves we might really need the converter
		attr := node.(*hclsyntax.Attribute)
		maker.nestedConverter = newHclConverter(maker.path + "/" + attr.Name)

	case hclsyntax.Blocks:
		// This just means we are entering the blocks list, not much to do with it since
		// we will know we are in an block when we get one

	case *hclsyntax.Block:
		blk := node.(*hclsyntax.Block)
		maker.nestedConverter = newHclConverter(maker.path + "/" + blk.Type)
	}
	return hcl.Diagnostics{}
}

func (maker *hclConverter) Exit(node hclsyntax.Node) hcl.Diagnostics {
	if maker.nestedConverter != nil && maker.nestedConverter.nestedConverter != nil {
		// Since every meaningful maker creates a nested maker on Enter, the second to last
		// maker is the one that should handle an Exit
		return maker.nestedConverter.Exit(node)
	}

	switch node.(type) {
	case *hclsyntax.Body:
		// pass

	case hclsyntax.Attributes:
		// pass

	case *hclsyntax.Attribute:
		attr := node.(*hclsyntax.Attribute)
		val, evalErrs := attr.Expr.Value(nil)
		// Convert evaluated value to something we can serialze to javascript
		maker.JSValue["attrs"].(map[string]interface{})[attr.Name] = convertValue(val)

		maker.nestedConverter = nil
		return evalErrs

	case hclsyntax.Blocks:
		// pass

	case *hclsyntax.Block:
		blk := node.(*hclsyntax.Block)
		maker.nestedConverter.JSValue["type"] = blk.Type
		labels := make([]interface{}, len(blk.Labels))
		for i, label := range blk.Labels {
			labels[i] = label
		}
		maker.nestedConverter.JSValue["labels"] = labels
		maker.JSValue["blocks"] = append(maker.JSValue["blocks"].([]interface{}), maker.nestedConverter.JSValue)

		maker.nestedConverter = nil
	}
	return hcl.Diagnostics{}
}
