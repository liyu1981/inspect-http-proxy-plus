package core

import (
	"net/http"
	"testing"
)

func TestCopyHeaders(t *testing.T) {
	src := http.Header{
		"Content-Type": []string{"application/json"},
		"X-Custom":     []string{"val1", "val2"},
	}
	dst := http.Header{}

	copyHeaders(src, dst)

	if dst.Get("Content-Type") != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", dst.Get("Content-Type"))
	}
	if len(dst["X-Custom"]) != 2 {
		t.Errorf("Expected 2 values for X-Custom, got %d", len(dst["X-Custom"]))
	}
}

func TestSingleJoiningSlash(t *testing.T) {
	tests := []struct {
		a, b string
		want string
	}{
		{"/a", "/b", "/a/b"},
		{"/a/", "/b", "/a/b"},
		{"/a", "b", "/a/b"},
		{"/a/", "b", "/a/b"},
		{"", "/b", "/b"},
		{"/a", "", "/a"},
		{"", "b", "/b"},
	}

	for _, tt := range tests {
		got := singleJoiningSlash(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("singleJoiningSlash(%q, %q) = %q, want %q", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestGetClientIP(t *testing.T) {
	req1, _ := http.NewRequest("GET", "/", nil)
	req1.RemoteAddr = "1.2.3.4:1234"
	if ip := getClientIP(req1); ip != "1.2.3.4" {
		t.Errorf("Expected 1.2.3.4, got %s", ip)
	}

	req2, _ := http.NewRequest("GET", "/", nil)
	req2.Header.Set("X-Forwarded-For", "5.6.7.8, 1.2.3.4")
	if ip := getClientIP(req2); ip != "5.6.7.8" {
		t.Errorf("Expected 5.6.7.8 from XFF, got %s", ip)
	}

	req3, _ := http.NewRequest("GET", "/", nil)
	req3.Header.Set("X-Real-IP", "9.10.11.12")
	if ip := getClientIP(req3); ip != "9.10.11.12" {
		t.Errorf("Expected 9.10.11.12 from X-Real-IP, got %s", ip)
	}
}

func TestIsPrintableContentType(t *testing.T) {
	if !isPrintableContentType("application/json") {
		t.Error("application/json should be printable")
	}
	if !isPrintableContentType("text/plain") {
		t.Error("text/plain should be printable")
	}
	if isPrintableContentType("image/png") {
		t.Error("image/png should NOT be printable")
	}
}
