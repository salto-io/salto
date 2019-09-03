package main

import (
	"sort"
	"syscall/js"

	"github.com/hashicorp/hcl2/hclwrite"
	"github.com/zclconf/go-cty/cty"
)

func convertJsToCty(jsValue js.Value) cty.Value {
	switch jsValue.Type() {
	case js.TypeString:
		return cty.StringVal(jsValue.String())
	case js.TypeBoolean:
		return cty.BoolVal(jsValue.Bool())
	case js.TypeNumber:
		return cty.NumberFloatVal(jsValue.Float())
	case js.TypeObject:
		keys := js.Global().Get("Object").Get("keys").Invoke(jsValue)
		// There doesn't seem to be a built in way to know if this is a list or an object
		// Since lists will always have "0" as the first key and objects cannot have "0" as a key we
		// can use that as a differentaitor, also, we assume there are no empty objects for now
		if keys.Length() == 0 || keys.Index(0).String() == "0" {
			// Parse as list
			elems := make([]cty.Value, keys.Length())
			for i := 0; i < keys.Length(); i++ {
				elems[i] = convertJsToCty(jsValue.Index(i))
			}
			return cty.TupleVal(elems)
		}
		// Parse as object
		attrs := make(map[string]cty.Value, keys.Length())
		for i := 0; i < keys.Length(); i++ {
			key := keys.Index(i).String()
			attrs[key] = convertJsToCty(jsValue.Get(key))
		}
		return cty.ObjectVal(attrs)

	default:
		return cty.DynamicVal
	}
}

func getBlock(body *hclwrite.Body, block js.Value) *hclwrite.Block {
	blockType := block.Get("type").String()
	blockLables := block.Get("labels")
	labels := make([]string, blockLables.Length())
	for i := 0; i < blockLables.Length(); i++ {
		labels[i] = blockLables.Index(i).String()
	}
	return body.AppendNewBlock(blockType, labels)
}

func fillBody(body *hclwrite.Body, value js.Value) {
	// Fill Attributes
	attrs := value.Get("attrs")
	attrsMap := convertJsToCty(attrs).AsValueMap()
	attrsKeys := make([]string, 0, len(attrsMap))
	for k := range attrsMap {
		attrsKeys = append(attrsKeys, k)
	}
	sort.Strings(attrsKeys)
	for _, k := range attrsKeys {
		body.SetAttributeValue(k, attrsMap[k])
	}

	// Fill blocks
	blocks := value.Get("blocks")
	for i := 0; i < blocks.Length(); i++ {
		blockVal := blocks.Index(i)
		blockType := blockVal.Get("type").String()
		blockLables := blockVal.Get("labels")
		labels := make([]string, blockLables.Length())
		for i := 0; i < blockLables.Length(); i++ {
			labels[i] = blockLables.Index(i).String()
		}
		block := body.AppendNewBlock(blockType, labels)
		fillBody(block.Body(), blockVal)
	}
}
