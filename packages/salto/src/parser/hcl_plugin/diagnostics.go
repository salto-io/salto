package main

import (
	"github.com/hashicorp/hcl2/hcl"
)

func convertPos(pos *hcl.Pos) map[string]interface{} {
	return map[string]interface{}{
		"line": pos.Line,
		"col":  pos.Column,
		"byte": pos.Byte,
	}
}

func convertSourceRange(src *hcl.Range) map[string]interface{} {
	return map[string]interface{}{
		"start":    convertPos(&src.Start),
		"end":      convertPos(&src.End),
		"filename": src.Filename,
	}
}

func convertDiagnostic(err *hcl.Diagnostic) map[string]interface{} {
	result := map[string]interface{}{
		"severity": int(err.Severity),
		"summary":  err.Summary,
		"detail":   err.Detail,
		"subject":  convertSourceRange(err.Subject),
	}

	if err.Context != nil {
		result["context"] = convertSourceRange(err.Context)
	}

	return result
}
